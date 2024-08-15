/** @format */
// File: src/extension.ts
import * as vscode from "vscode";
import * as http from "http";
import * as https from "https";
import { URL } from "url";

let proxyServer: http.Server | null = null;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "mfolarin-vscode-web-browser-extension" is now active!');

    // Create an output channel for logging
    outputChannel = vscode.window.createOutputChannel("VS Code Browser Debug");

    let disposable = vscode.commands.registerCommand('mfolarin-vscode-web-browser.openBrowser', () => {
        startProxyServer().then(() => {
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
                        case 'proxyRequest':
                            handleProxyRequest(message.url, panel.webview);
                            return;
                        case 'log':
                            outputChannel.appendLine(`[Webview Console] $(message.text)`);
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );
        });
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
                    const tab = { url, title, content, history: [], currentIndex: -1 };
                    tabs.push(tab);
                    switchTab(tabs.length - 1);
                    saveTabs();
                    console.error("number of tabs"+ tabs.length+": "+tab.title);
                }

                function renderTabs() {
                    tabsContainer.innerHTML = '';
                    tabs.forEach((tab, index) => {
                        const tabElement = document.createElement('div');
                        tabElement.className = 'tab' + (index === currentTabIndex ? ' active' : '');
                        const titleSpan = document.createElement('span');
                        titleSpan.textContent = tab.url.replace("https://","") || 'Tab ' + (index+1);
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
                    
                    browserFrame.document.open();
                    browserFrame.document.write(tabs[currentTabIndex].content);
                    browserFrame.document.close();
                    history.pushState(null, '', tabs[currentTabIndex].url);
                }
                
                function renderTab(index, url, content){
                    console.log("in renderTab", index, url, content, tabs.length);
                    if(tabs.length > index){
                        console.log("tabs.length > index");
                        tabs[index].url = url;
                        tabs[index].title = url.replace("https://","");
                        tabs[index].content = content;
                        tabs[index].history.push(url);
                        switchTab(index);
                        saveTabs();
                    } 
                }

                function switchTab(index) {
                    console.log("in switchTab", index, tabs.length, tabs[index]);
                    currentTabIndex = index;
                    renderTabs();
                    urlInput.value = tabs[currentTabIndex].url;
                }

                function closeTab(index) {
                    tabs.splice(index, 1);
                    if (tabs.length === 0) {
                        createTab();
                    } else if (currentTabIndex >= tabs.length) {
                        currentTabIndex = tabs.length - 1;
                    }
                    switchTab(currentTabIndex);
                    saveTabs();
                }

                
                function navigateTo(url) {
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    vscode.postMessage({ command: 'proxyRequest', url });
                    urlInput.value = url;
                    saveHistoryItem(url);
                }

                //TODO: save current tab index so it is restored
                function saveTabs() {
                    console.log("In saveTabs", tabs.length, currentTabIndex);
                    const tabsToSave = tabs.map(tab => ({ url: tab.url, title: tab.title, content: tab.content }));
                    vscode.postMessage({ command: 'saveTabs', tabs: tabsToSave });
                }

                function loadTabs() {
                    vscode.postMessage({ command: 'getTabs' });
                }
                
                function restoreTabs(savedTabs) {
                    console.log("in restoreTabs", savedTabs.length);
                    
                    if (savedTabs.length > 0) {
                        tabs = savedTabs.map(tab => ({ ...tab, history: [], currentIndex: -1 }));
                        currentTabIndex = 0; //TODO: read value from extension state
                        switchTab(currentTabIndex);
                    } else {
                        createTab();
                    }
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
                    // const url = browserFrame.contentWindow.location.href;
                    // const title = browserFrame.contentDocument.title || url;
                    // urlInput.value = url;
                    // tabs[currentTabIndex].url = url;
                    // tabs[currentTabIndex].title = title;
                    // renderTabs();
                    // saveTabs();
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
                        case 'proxyResponse':
                            renderTab(currentTabIndex, message.url, message.data);
                            break;
                        case 'proxyError':
                            console.error('Proxy error:', message.error);
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
                
                function consoleLog(...args){
                    const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg): String(arg).join(' '));
                    vscode.postMessage({command: 'log', text});
                }
                const systemConsoleLog = console.log;
                console.log = function(...args){
                    systemConsoleLog.apply(console, args);
                    consoleLog(...args);
                }
                    
                console.log("Initializing web view");
                console.log("Object test: ", { key: 'value' });

                // Initial setup
                loadTabs();
                loadBookmarks();
                loadHistory();
            </script>
        </body>
        </html>
    `;
}

async function startProxyServer() {
    if (proxyServer) {
        return;
    }

    proxyServer = http.createServer((req, res) => {
        const targetUrl = new URL(req.url?.slice(1) || '');
        outputChannel.appendLine(`Proxy request received for: ${targetUrl.toString()}`);
        outputChannel.appendLine(`Method: ${req.method}`);
        outputChannel.appendLine(`Headers: ${JSON.stringify(req.headers, null, 2)}`);

        const options: http.RequestOptions | https.RequestOptions = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: {
                ...req.headers,
                host: targetUrl.host,
            },
        };

        const proxyReq = (targetUrl.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
            outputChannel.appendLine(`Proxy response received from: ${targetUrl.toString()}`);
            outputChannel.appendLine(`Status Code: ${proxyRes.statusCode}`);
            outputChannel.appendLine(`Headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);

            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (error) => {
            outputChannel.appendLine(`Proxy request error: ${error.message}`);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Proxy Error: ' + error.message);
        });

        req.pipe(proxyReq);
    });

    proxyServer.listen(0, '127.0.0.1', () => {
        const address = proxyServer?.address();
        if (address && typeof address !== 'string') {
            outputChannel.appendLine(`Proxy server running on port ${address.port}`);
        }
    });
}
function handleProxyRequest(url: string, webview: vscode.Webview) {
    const proxyUrl = `http://127.0.0.1:${(proxyServer?.address() as any).port}/${url}`;

    outputChannel.appendLine(`Handling proxy request for: ${url}`);
    outputChannel.appendLine(`Proxy URL: ${proxyUrl}`);

    const fetchContent = (currentUrl: string, redirectCount = 0): Promise<string> => {
        return new Promise((resolve, reject) => {
            const protocol = currentUrl.startsWith('https') ? https : http;
            protocol.get(currentUrl, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirectCount > 5) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    const redirectUrl = new URL(res.headers.location, currentUrl).toString();
                    outputChannel.appendLine(`Redirecting to: ${redirectUrl}`);
                    fetchContent(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
                } else {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        outputChannel.appendLine(`Response received for: ${currentUrl}`);
                        outputChannel.appendLine(`Response size: ${data.length} bytes`);
                        outputChannel.appendLine(`Response body: ${data}`);
                        resolve(data);
                    });
                }
            }).on('error', (err) => {
                reject(err);
            });
        });
    };

    fetchContent(proxyUrl)
        .then((content) => {
            // Modify content to handle relative URLs
            const baseUrl = new URL(url);
            content = content.replace(/(src|href)="\/(?!\/)/g, `$1="${baseUrl.origin}/`);
            content = content.replace(/(src|href)="(?!http|\/\/)/g, `$1="${baseUrl.origin}/${baseUrl.pathname.split('/').slice(1, -1).join('/')}/`);

            webview.postMessage({ command: 'proxyResponse', data: content, url: url });
        })
        .catch((err) => {
            outputChannel.appendLine(`Error in handleProxyRequest: ${err.message}`);
            webview.postMessage({ command: 'proxyError', error: err.message, url: url });
        });
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


export function deactivate() {
    if (proxyServer) {
        proxyServer.close();
    }
    outputChannel.dispose();
}