/* globals savePageToWallabag */
if (typeof (browser) === 'undefined' && typeof (chrome) === 'object') {
    browser = chrome;
}

const wallabagContextMenus = [
    {
        id: 'wallabagger-add-link',
        title: 'Wallabag it!',
        contexts: ['link', 'page']
    }
];

wallabagContextMenus.map(menu => { browser.contextMenus.create(menu); });
browser.contextMenus.onClicked.addListener(onContextMenusClicked);

function onContextMenusClicked (info) {
    switch (info.menuItemId) {
        case 'wallabagger-add-link':
            if (typeof (info.linkUrl) === 'string' && info.linkUrl.length > 0) {
                savePageToWallabag(info.linkUrl, true);
            } else {
                savePageToWallabag(info.pageUrl, false);
            }
            break;
    }
}
