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
            <title>VS Code Browser</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 10px; }
                #navbar { display: flex; margin-bottom: 10px; }
                #urlInput { flex-grow: 1; margin-right: 5px; }
                #tabsContainer { display: flex; margin-bottom: 10px; }
                .tab { padding: 5px 10px; border: 1px solid #ccc; margin-right: 5px; cursor: pointer; }
                .tab.active { background-color: #e0e0e0; }
                #browserFrame { width: 100%; height: 500px; border: none; }
                #bookmarksContainer { margin-top: 10px; }
                .bookmark { margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div id="navbar">
                <button id="backButton">←</button>
                <button id="forwardButton">→</button>
                <button id="refreshButton">↻</button>
                <input type="text" id="urlInput" placeholder="Enter URL">
                <button id="goButton">Go</button>
                <button id="addTabButton">+</button>
            </div>
            <div id="tabsContainer"></div>
            <iframe id="browserFrame"></iframe>
            <div id="bookmarksContainer">
                <h3>Bookmarks</h3>
                <div id="bookmarksList"></div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const urlInput = document.getElementById('urlInput');
                const goButton = document.getElementById('goButton');
                const browserFrame = document.getElementById('browserFrame');
                const backButton = document.getElementById('backButton');
                const forwardButton = document.getElementById('forwardButton');
                const refreshButton = document.getElementById('refreshButton');
                const addTabButton = document.getElementById('addTabButton');
                const tabsContainer = document.getElementById('tabsContainer');
                const bookmarksList = document.getElementById('bookmarksList');

                let tabs = [];
                let currentTabIndex = -1;
                let history = [];
                let currentHistoryIndex = -1;

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
                }

                function loadBookmarks() {
                    vscode.postMessage({ command: 'getBookmarks' });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateBookmarks':
                            renderBookmarks(message.bookmarks);
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

                // Initial setup
                createTab();
                loadBookmarks();
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

export function deactivate() {}