/* globals savePageToWallabag, api */
if (typeof (browser) === 'undefined' && typeof (chrome) === 'object') {
    browser = chrome;
}

const wallabagContextMenus = [
    {
        id: 'wallabagger-add-link',
        title: 'Wallabag it!',
        contexts: ['link', 'page']
    },
    {
        type: 'separator',
        contexts: ['browser_action']
    },
    {
        id: 'unread',
        title: 'Unread articles',
        contexts: ['browser_action']
    },
    {
        id: 'starred',
        title: 'Starred articles',
        contexts: ['browser_action']
    },
    {
        id: 'archive',
        title: 'Archived articles',
        contexts: ['browser_action']
    },
    {
        id: 'all',
        title: 'All articles',
        contexts: ['browser_action']
    },
    {
        id: 'tag',
        title: 'Tag list',
        contexts: ['browser_action']
    }
];

browser.contextMenus.onClicked.addListener(onContextMenusClicked);
wallabagContextMenus.map(menu => { browser.contextMenus.create(menu); });

function onContextMenusClicked (info) {
    switch (info.menuItemId) {
        case 'wallabagger-add-link':
            if (typeof (info.linkUrl) === 'string' && info.linkUrl.length > 0) {
                savePageToWallabag(info.linkUrl, true);
            } else {
                savePageToWallabag(info.pageUrl, false);
            }
            break;
        case 'unread':
        case 'starred':
        case 'archive':
        case 'all':
        case 'tag':
            GotoWallabag(info.menuItemId);
            break;
    }
}

const GotoWallabag = (part) => api.checkParams() && browser.tabs.create({ url: `${api.data.Url}/${part}/list` });
