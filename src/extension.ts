// File: src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-browser-extension" is now active!');

    let disposable = vscode.commands.registerCommand('vscode-browser.openBrowser', () => {
        const panel = vscode.window.createWebviewPanel(
            'browserView',
            'Web Browser',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = getWebviewContent(context);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'saveBookmark':
                        saveBookmark(context, message.url, message.title);
                        return;
                    case 'getBookmarks':
                        const bookmarks = getBookmarks(context);
                        panel.webview.postMessage({ command: 'updateBookmarks', bookmarks });
                        return;
                    case 'saveHistory':
                        saveHistory(context, message.url, message.title);
                        return;
                    case 'getHistory':
                        const history = getHistory(context);
                        panel.webview.postMessage({ command: 'updateHistory', history });
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(context: vscode.ExtensionContext) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https:;">
            <title>VS Code Browser</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 10px; display: flex; flex-direction: column; height: 100vh; margin: 0; }
                #navbar { display: flex; margin-bottom: 10px; }
                #urlInput { flex-grow: 1; margin-right: 5px; }
                #tabsContainer { display: flex; margin-bottom: 10px; }
                .tab { padding: 5px 10px; border: 1px solid #ccc; margin-right: 5px; cursor: pointer; }
                .tab.active { background-color: #e0e0e0; }
                #browserFrame { flex-grow: 1; border: none; }
                #bottomPanel { display: flex; height: 150px; margin-top: 10px; }
                #bookmarksContainer, #historyContainer { flex: 1; overflow-y: auto; margin-right: 10px; }
                .bookmark, .history-item { margin-bottom: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div id="navbar">
                <button id="backButton">←</button>
                <button id="forwardButton">→</button>
                <button id="refreshButton">↻</button>
                <input type="text" id="urlInput" placeholder="Enter URL">
                <button id="goButton">Go</button>
                <button id="bookmarkButton">🔖</button>
                <button id="addTabButton">+</button>
            </div>
            <div id="tabsContainer"></div>
            <iframe id="browserFrame"></iframe>
            <div id="bottomPanel">
                <div id="bookmarksContainer">
                    <h3>Bookmarks</h3>
                    <div id="bookmarksList"></div>
                </div>
                <div id="historyContainer">
                    <h3>History</h3>
                    <div id="historyList"></div>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const urlInput = document.getElementById('urlInput');
                const goButton = document.getElementById('goButton');
                const browserFrame = document.getElementById('browserFrame');
                const backButton = document.getElementById('backButton');
                const forwardButton = document.getElementById('forwardButton');
                const refreshButton = document.getElementById('refreshButton');
                const bookmarkButton = document.getElementById('bookmarkButton');
                const addTabButton = document.getElementById('addTabButton');
                const tabsContainer = document.getElementById('tabsContainer');
                const bookmarksList = document.getElementById('bookmarksList');
                const historyList = document.getElementById('historyList');

                let tabs = [];
                let currentTabIndex = -1;

                function createTab(url = '') {
                    const tab = { url, history: [], currentIndex: -1 };
                    tabs.push(tab);
                    currentTabIndex = tabs.length - 1;
                    renderTabs();
                    navigateTo(url);
                }

                function renderTabs() {
                    tabsContainer.innerHTML = '';
                    tabs.forEach((tab, index) => {
                        const tabElement = document.createElement('div');
                        tabElement.className = 'tab' + (index === currentTabIndex ? ' active' : '');
                        tabElement.textContent = tab.url || 'New Tab';
                        tabElement.onclick = () => switchTab(index);
                        tabsContainer.appendChild(tabElement);
                    });
                }

                function switchTab(index) {
                    currentTabIndex = index;
                    renderTabs();
                    urlInput.value = tabs[currentTabIndex].url;
                    browserFrame.src = tabs[currentTabIndex].url;
                }

                function navigateTo(url) {
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    browserFrame.src = url;
                    urlInput.value = url;
                    tabs[currentTabIndex].url = url;
                    tabs[currentTabIndex].history = tabs[currentTabIndex].history.slice(0, tabs[currentTabIndex].currentIndex + 1);
                    tabs[currentTabIndex].history.push(url);
                    tabs[currentTabIndex].currentIndex = tabs[currentTabIndex].history.length - 1;
                    renderTabs();
                    saveHistoryItem(url);
                }

                goButton.addEventListener('click', () => navigateTo(urlInput.value));
                urlInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') navigateTo(urlInput.value);
                });

                backButton.addEventListener('click', () => {
                    if (tabs[currentTabIndex].currentIndex > 0) {
                        tabs[currentTabIndex].currentIndex--;
                        browserFrame.src = tabs[currentTabIndex].history[tabs[currentTabIndex].currentIndex];
                        urlInput.value = browserFrame.src;
                    }
                });

                forwardButton.addEventListener('click', () => {
                    if (tabs[currentTabIndex].currentIndex < tabs[currentTabIndex].history.length - 1) {
                        tabs[currentTabIndex].currentIndex++;
                        browserFrame.src = tabs[currentTabIndex].history[tabs[currentTabIndex].currentIndex];
                        urlInput.value = browserFrame.src;
                    }
                });

                refreshButton.addEventListener('click', () => {
                    browserFrame.src = browserFrame.src;
                });

                bookmarkButton.addEventListener('click', () => saveBookmark());

                addTabButton.addEventListener('click', () => createTab());

                browserFrame.addEventListener('load', () => {
                    const url = browserFrame.contentWindow.location.href;
                    urlInput.value = url;
                    tabs[currentTabIndex].url = url;
                    renderTabs();
                });

                function saveBookmark() {
                    const url = browserFrame.src;
                    const title = browserFrame.contentDocument.title || url;
                    vscode.postMessage({ command: 'saveBookmark', url, title });
                    loadBookmarks();
                }

                function loadBookmarks() {
                    vscode.postMessage({ command: 'getBookmarks' });
                }

                function saveHistoryItem(url) {
                    const title = url;
                    vscode.postMessage({ command: 'saveHistory', url, title });
                    loadHistory();
                }

                function loadHistory() {
                    vscode.postMessage({ command: 'getHistory' });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateBookmarks':
                            renderBookmarks(message.bookmarks);
                            break;
                        case 'updateHistory':
                            renderHistory(message.history);
                            break;
                    }
                });

                function renderBookmarks(bookmarks) {
                    bookmarksList.innerHTML = '';
                    bookmarks.forEach(bookmark => {
                        const bookmarkElement = document.createElement('div');
                        bookmarkElement.className = 'bookmark';
                        bookmarkElement.textContent = bookmark.title;
                        bookmarkElement.onclick = () => navigateTo(bookmark.url);
                        bookmarksList.appendChild(bookmarkElement);
                    });
                }

                function renderHistory(history) {
                    historyList.innerHTML = '';
                    history.forEach(item => {
                        const historyElement = document.createElement('div');
                        historyElement.className = 'history-item';
                        historyElement.textContent = item.title;
                        historyElement.onclick = () => navigateTo(item.url);
                        historyList.appendChild(historyElement);
                    });
                }

                // Initial setup
                createTab();
                loadBookmarks();
                loadHistory();
            </script>
        </body>
        </html>
    `;
}

function saveBookmark(context: vscode.ExtensionContext, url: string, title: string) {
    const bookmarks = context.globalState.get<Array<{url: string, title: string}>>('bookmarks', []);
    bookmarks.push({ url, title });
    context.globalState.update('bookmarks', bookmarks);
}

function getBookmarks(context: vscode.ExtensionContext): Array<{url: string, title: string}> {
    return context.globalState.get<Array<{url: string, title: string}>>('bookmarks', []);
}

function saveHistory(context: vscode.ExtensionContext, url: string, title: string) {
    const history = context.globalState.get<Array<{url: string, title: string}>>('history', []);
    history.unshift({ url, title });
    if (history.length > 100) {history.pop();} // Limit history to 100 items
    context.globalState.update('history', history);
}

function getHistory(context: vscode.ExtensionContext): Array<{url: string, title: string}> {
    return context.globalState.get<Array<{url: string, title: string}>>('history', []);
}

export function deactivate() {}