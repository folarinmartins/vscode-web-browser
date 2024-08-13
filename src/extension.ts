/** @format */
// File: src/extension.ts
import * as vscode from "vscode";
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
                    case 'deleteHistoryItem':
                        deleteHistoryItem(context, message.url);
                        return;
                    case 'clearHistory':
                        clearHistory(context);
                        return;
                    case 'saveTabs':
                        saveTabs(context, message.tabs);
                        return;
                    case 'getTabs':
                        const tabs = getTabs(context);
                        panel.webview.postMessage({ command: 'restoreTabs', tabs });
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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src *; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https:;">
            <title>VS Code Browser</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 0; margin: 0; display: flex; flex-direction: column; height: 100vh; }
                #topPanel { position: fixed; top: 0; left: 0; right: 0; background: #f0f0f0; z-index: 1000; padding: 10px; }
                #navbar { display: flex; margin-bottom: 10px; }
                #urlInput { flex-grow: 1; margin-right: 5px; }
                #tabsContainer { display: flex; margin-bottom: 10px; } 
                .tab { display: flex; align-items: center; padding: 5px 10px; border: 1px solid #ccc; margin-right: 5px; cursor: pointer; }
                .tab-close { margin-left: 5px; cursor: pointer; }
                .tab.active { background-color: #e0e0e0; }
                #browserFrame { flex-grow: 1; border: none; margin-top: 100px; }
                #bottomPanel { position: fixed; bottom: 0; left: 0; right: 0; background: #f0f0f0; }
                .panel-header { padding: 10px; background: #e0e0e0; cursor: pointer; }
                .panel-content { max-height: 200px; overflow-y: auto; display: none; padding: 10px; }
                .panel-content.active { display: block; }
                .bookmark, .history-item { margin-bottom: 5px; cursor: pointer; }
                .history-item { display: flex; justify-content: space-between; }
                .delete-history { cursor: pointer; color: red; }
            </style>
        </head>
        <body>
            <div id="topPanel">
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
            </div>
            <iframe id="browserFrame" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
            <div id="bottomPanel">
                <div class="panel-header" id="bookmarksHeader">Bookmarks</div>
                <div class="panel-content" id="bookmarksContainer">
                    <div id="bookmarksList"></div>
                </div>
                <div class="panel-header" id="historyHeader">History</div>
                <div class="panel-content" id="historyContainer">
                    <button id="clearHistoryButton">Clear All History</button>
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
                const clearHistoryButton = document.getElementById('clearHistoryButton');
                const bookmarksHeader = document.getElementById('bookmarksHeader');
                const historyHeader = document.getElementById('historyHeader');
                const bookmarksContainer = document.getElementById('bookmarksContainer');
                const historyContainer = document.getElementById('historyContainer');

                let tabs = [];
                let currentTabIndex = -1;

                function createTab(url = '', title = 'New Tab') {
                    const tab = { url, title, history: [], currentIndex: -1 };
                    tabs.push(tab);
                    currentTabIndex = tabs.length - 1;
                    renderTabs();
                    navigateTo(url);
                    saveTabs();
                }

                function renderTabs() {
                    tabsContainer.innerHTML = '';
                    tabs.forEach((tab, index) => {
                        const tabElement = document.createElement('div');
                        tabElement.className = 'tab' + (index === currentTabIndex ? ' active' : '');
                        const titleSpan = document.createElement('span');
                        titleSpan.textContent = tab.title || 'New Tab';
                        titleSpan.onclick = () => switchTab(index);
                        const closeButton = document.createElement('span');
                        closeButton.textContent = '×';
                        closeButton.className = 'tab-close';
                        closeButton.onclick = (e) => {
                            e.stopPropagation();
                            closeTab(index);
                        };
                        tabElement.appendChild(titleSpan);
                        tabElement.appendChild(closeButton);
                        tabsContainer.appendChild(tabElement);
                    });
                }

                function switchTab(index) {
                    currentTabIndex = index;
                    renderTabs();
                    urlInput.value = tabs[currentTabIndex].url;
                    browserFrame.src = tabs[currentTabIndex].url;
                }

                function closeTab(index) {
                    tabs.splice(index, 1);
                    if (tabs.length === 0) {
                        createTab();
                    } else if (currentTabIndex >= tabs.length) {
                        currentTabIndex = tabs.length - 1;
                    }
                    renderTabs();
                    switchTab(currentTabIndex);
                    saveTabs();
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
                    saveTabs();
                }

                function saveTabs() {
                    const tabsToSave = tabs.map(tab => ({ url: tab.url, title: tab.title }));
                    vscode.postMessage({ command: 'saveTabs', tabs: tabsToSave });
                }

                function loadTabs() {
                    vscode.postMessage({ command: 'getTabs' });
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
                    const title = browserFrame.contentDocument.title || url;
                    urlInput.value = url;
                    tabs[currentTabIndex].url = url;
                    tabs[currentTabIndex].title = title;
                    renderTabs();
                    saveTabs();
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

                function deleteHistoryItem(url) {
                    vscode.postMessage({ command: 'deleteHistoryItem', url });
                    loadHistory();
                }

                clearHistoryButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'clearHistory' });
                    loadHistory();
                });

                bookmarksHeader.addEventListener('click', () => {
                    bookmarksContainer.classList.toggle('active');
                });

                historyHeader.addEventListener('click', () => {
                    historyContainer.classList.toggle('active');
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateBookmarks':
                            renderBookmarks(message.bookmarks);
                            break;
                        case 'updateHistory':
                            renderHistory(message.history);
                            break;
                        case 'restoreTabs':
                            restoreTabs(message.tabs);
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
                    
                
                function restoreTabs(savedTabs) {
                    if (savedTabs.length > 0) {
                        tabs = savedTabs.map(tab => ({ ...tab, history: [], currentIndex: -1 }));
                        currentTabIndex = 0;
                        renderTabs();
                        navigateTo(tabs[currentTabIndex].url);
                    } else {
                        createTab();
                    }
                }

                function renderHistory(history) {
                    historyList.innerHTML = '';
                    history.forEach(item => {
                        const historyElement = document.createElement('div');
                        historyElement.className = 'history-item';
                        const titleSpan = document.createElement('span');
                        titleSpan.textContent = item.title;
                        titleSpan.onclick = () => navigateTo(item.url);
                        const deleteButton = document.createElement('span');
                        deleteButton.textContent = '🗑️';
                        deleteButton.className = 'delete-history';
                        deleteButton.onclick = (e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item.url);
                        };
                        historyElement.appendChild(titleSpan);
                        historyElement.appendChild(deleteButton);
                        historyList.appendChild(historyElement);
                    });
                }

                // Initial setup
                loadTabs();
                loadBookmarks();
                loadHistory();
            </script>
        </body>
        </html>
    `;
}

function saveTabs(context: vscode.ExtensionContext, tabs: Array<{ url: string, title: string }>) {
    context.globalState.update('vscode_browser_tabs', tabs);
}

function getTabs(context: vscode.ExtensionContext): Array<{ url: string, title: string }> {
    return context.globalState.get<Array<{ url: string, title: string }>>('vscode_browser_tabs', []);
}
function saveBookmark(context: vscode.ExtensionContext, url: string, title: string) {
    const bookmarks = context.globalState.get<Array<{ url: string; title: string }>>("vscode_browser_bookmarks", []);
    bookmarks.push({ url, title });
    context.globalState.update("vscode_browser_bookmarks", bookmarks);
}

function getBookmarks(context: vscode.ExtensionContext): Array<{ url: string; title: string }> {
    return context.globalState.get<Array<{ url: string; title: string }>>("vscode_browser_bookmarks", []);
}

function saveHistory(context: vscode.ExtensionContext, url: string, title: string) {
    const history = context.globalState.get<Array<{ url: string; title: string }>>("vscode_browser_history", []);
    history.unshift({ url, title });
    if (history.length > 100) history.pop(); // Limit history to 100 items
    context.globalState.update("vscode_browser_history", history);
}

function getHistory(context: vscode.ExtensionContext): Array<{ url: string; title: string }> {
    return context.globalState.get<Array<{ url: string; title: string }>>("vscode_browser_history", []);
}

function deleteHistoryItem(context: vscode.ExtensionContext, url: string) {
    const history = context.globalState.get<Array<{ url: string; title: string }>>("vscode_browser_history", []);
    const updatedHistory = history.filter((item) => item.url !== url);
    context.globalState.update("vscode_browser_history", updatedHistory);
}

function clearHistory(context: vscode.ExtensionContext) {
    context.globalState.update("vscode_browser_history", []);
}

export function deactivate() { }
