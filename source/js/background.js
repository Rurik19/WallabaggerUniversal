if (typeof (browser) === 'undefined' && typeof (chrome) === 'object') {
    browser = chrome;
}

let Port = null;
let portConnected = false;

var CacheType = function (enable) {
    this.enabled = enable;
    this._cache = [];
};

const manifest = browser.runtime.getManifest();
let defaultIcon = 'images/wallabagger-16.png';

if ('browser_action' in manifest && manifest.browser_action) { defaultIcon = Object.values(manifest.browser_action.default_icon)[0]; }
if ('page_action' in manifest && manifest.page_action) { defaultIcon = Object.values(manifest.page_action.default_icon)[0]; }

const browserIcon = {
    images: {
        'default': defaultIcon,
        'good': 'images/wallabagger-green.svg',
        'wip': 'images/wallabagger-yellow.svg',
        'bad': 'images/wallabagger-red.svg'
    },

    timedToDefault: function () {
        setTimeout(() => {
            this.set('default');
        }, 5000);
    },

    set: function (icon) {
        browser.browserAction && browser.browserAction.setIcon({ path: this.images[icon] });
        !browser.browserAction && browser.pageAction && browser.pageAction.setIcon({ path: this.images[icon] });
    },

    setTimed: function (icon) {
        this.set(icon);
        this.timedToDefault();
    }
};

CacheType.prototype = {
    _cache: null,
    enabled: false,

    str: function (some) {
        return btoa(unescape(encodeURIComponent(some)));
    },

    set: function (key, data) {
        if (this.enabled) {
            const a = this.str(key);
            this._cache[a] = data;
        }
    },

    clear: function (key) {
        if (this.enabled) {
            delete this._cache[this.str(key)];
        }
    },

    check: function (key) {
        return this.enabled && (this._cache[this.str(key)] !== undefined);
    },

    get: function (key) {
        return this.enabled ? this._cache[this.str(key)] : undefined;
    }
};

const existStates = {
    exists: 'exists',
    notexists: 'notexists',
    wip: 'wip'
};

const cache = new CacheType(true); // TODO - here checking option
const dirtyCache = new CacheType(true);
const existCache = new CacheType(true);

const api = new WallabagApi();

// Code

api.init().then(data => {
    addExistCheckListeners(api.data.AllowExistCheck);
    api.GetTags().then(tags => { cache.set('allTags', tags); });
});

const version = browser.runtime.getManifest().version.split('.');
version.length === 4 && browser.browserAction && browser.browserAction.setBadgeText({ text: 'ß' });

addListeners();

// Functions

function onTabActivatedListener (activeInfo) {
    browserIcon.set('default');
    const { tabId } = activeInfo;
    browser.tabs.get(tabId, function (tab) {
        checkExist(tab.url);
    });
}

function onTabCreatedListener (tab) {
    browserIcon.set('default');
}

function onTabUpdatedListener (tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading' && tab.active) {
        saveExistFlag(tab.url, existStates.notexists);
        requestExists(tab.url);
    }
}

function addExistCheckListeners (enable) {
    if (enable === true) {
        browser.tabs.onActivated.addListener(onTabActivatedListener);
        browser.tabs.onCreated.addListener(onTabCreatedListener);
        browser.tabs.onUpdated.addListener(onTabUpdatedListener);
    } else {
        if (browser.tabs && browser.tabs.onActivated.hasListener(onTabActivatedListener)) {
            browser.tabs.onActivated.removeListener(onTabActivatedListener);
        }
        if (browser.tabs && browser.tabs.onCreated.hasListener(onTabCreatedListener)) {
            browser.tabs.onCreated.removeListener(onTabCreatedListener);
        }
        if (browser.tabs && browser.tabs.onUpdated.hasListener(onTabUpdatedListener)) {
            browser.tabs.onUpdated.removeListener(onTabUpdatedListener);
        }
    }
}

function postIfConnected (obj) {
    portConnected && Port.postMessage(obj);
    // console.log(`post message: ${JSON.stringify(obj)}`);
}

function onPortMessage (msg) {
    // console.log(`income message: ${JSON.stringify(msg)}`);
    try {
        switch (msg.request) {
            case 'save':
                savePageToWallabag(msg.tabUrl, false);
                break;
            case 'tags':
                if (!cache.check('allTags')) {
                    api.GetTags()
                        .then(data => {
                            postIfConnected({ response: 'tags', tags: data });
                            cache.set('allTags', data);
                        });
                } else {
                    postIfConnected({ response: 'tags', tags: cache.get('allTags') });
                }
                break;
            case 'saveTitle':
                if (msg.articleId !== -1) {
                    api.SaveTitle(msg.articleId, msg.title).then(data => {
                        postIfConnected({ response: 'title', title: data.title });
                        cache.set(msg.tabUrl, cutArticle(data));
                    });
                } else {
                    dirtyCacheSet(msg.tabUrl, {title: msg.title});
                }
                break;
            case 'deleteArticle':
                if (msg.articleId !== -1) {
                    api.DeleteArticle(msg.articleId).then(data => {
                        cache.clear(msg.tabUrl);
                    });
                } else {
                    dirtyCacheSet(msg.tabUrl, {deleted: true});
                }
                browserIcon.set('default');
                saveExistFlag(msg.tabUrl, existStates.notexists);
                break;
            case 'setup':
                postIfConnected({ response: 'setup', data: api.data });
                break;
            case 'setup-save':
                api.setsave(msg.data);
                postIfConnected({ response: 'setup-save', data: api.data });
                addExistCheckListeners(msg.data.AllowExistCheck);
                break;
            case 'setup-gettoken':
                api.setsave(msg.data);
                api.PasswordToken()
                    .then(a => {
                        postIfConnected({ response: 'setup-gettoken', data: api.data, result: true });
                        if (!cache.check('allTags')) {
                            api.GetTags()
                                .then(data => { cache.set('allTags', data); });
                        }
                    })
                    .catch(a => {
                        postIfConnected({ response: 'setup-gettoken', data: api.data, result: false });
                    });
                break;
            case 'setup-checkurl':
                api.setsave(msg.data);
                api.CheckUrl()
                    .then(a => {
                        postIfConnected({ response: 'setup-checkurl', data: api.data, result: true });
                    })
                    .catch(a => {
                        api.clear();
                        postIfConnected({ response: 'setup-checkurl', data: api.data, result: false });
                    });
                break;
            case 'deleteArticleTag':
                if (msg.articleId !== -1) {
                    api.DeleteArticleTag(msg.articleId, msg.tagId).then(data => {
                        postIfConnected({ response: 'articleTags', tags: data.tags });
                        cache.set(msg.tabUrl, cutArticle(data));
                    });
                } else {
                    dirtyCacheSet(msg.tabUrl, {tagList: msg.tags});
                }
                break;
            case 'saveTags':
                if (msg.articleId !== -1) {
                    api.SaveTags(msg.articleId, msg.tags).then(data => {
                        postIfConnected({ response: 'articleTags', tags: data.tags });
                        cache.set(msg.tabUrl, cutArticle(data));
                        return data;
                    })
                    .then(data => {
                        addToAllTags(data.tags);
                    });
                } else {
                    addDirtyToAllTags(msg.tags);
                    dirtyCacheSet(msg.tabUrl, {tagList: msg.tags});
                }
                break;
            case 'SaveStarred':
            case 'SaveArchived':
                if (msg.articleId !== -1) {
                    api[msg.request](msg.articleId, msg.value ? 1 : 0).then(data => {
                        postIfConnected({ response: 'action', value: {starred: data.is_starred, archived: data.is_archived} });
                        cache.set(msg.tabUrl, cutArticle(data));
                    });
                } else {
                    dirtyCacheSet(msg.tabUrl, (msg.request === 'SaveStarred') ? {is_starred: msg.value} : {is_archived: msg.value});
                }
                break;
            default: {
                console.log(`unknown request ${JSON.stringify(msg)}`);
            }
        }
    } catch (error) {
        browserIcon.setTimed('bad');
        postIfConnected({ response: 'error', error: error });
    }
}

function onRuntimeConnect (port) {
    Port = port;
    portConnected = true;

    Port.onDisconnect.addListener(function () { portConnected = false; });
    Port.onMessage.addListener(onPortMessage);
}

function addListeners () {
    browser.runtime.onConnect.addListener(onRuntimeConnect);
}


function dirtyCacheSet (key, obj) {
    dirtyCache.set(key, Object.assign(dirtyCache.check(key) ? dirtyCache.get(key) : {}, obj));
    dirtyCache.set(key, Object.assign(dirtyCache.check(key) ? dirtyCache.get(key) : {}, { id: -1, url: key }));
}

function applyDirtyCacheLight (key, data) {
    if (dirtyCache.check(key)) {
        const dirtyObject = dirtyCache.get(key);
        if (!dirtyObject.deleted) {
            if ((dirtyObject.title !== undefined) || (dirtyObject.is_archived !== undefined) ||
                 (dirtyObject.is_starred !== undefined) || (dirtyObject.tagList !== undefined)) {
                data.changed = true;
            }
            data.title = dirtyObject.title !== undefined ? dirtyObject.title : data.title;
            data.is_archived = dirtyObject.is_archived !== undefined ? dirtyObject.is_archived : data.is_archived;
            data.is_starred = dirtyObject.is_starred !== undefined ? dirtyObject.is_starred : data.is_starred;
            data.tagList =
            (dirtyObject.tagList !== undefined ? dirtyObject.tagList.split(',') : [])
            .concat(data.tags.map(t => t.label))
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(',');
        } else {
            data.deleted = true;
        }
    }
    return data;
}

function applyDirtyCacheReal (key, data) {
    if (dirtyCache.check(key)) {
        const dirtyObject = dirtyCache.get(key);
        if (dirtyObject.deleted !== undefined) {
            return api.DeleteArticle(data.id).then(a => { dirtyCache.clear(key); });
        } else {
            if (data.changed !== undefined) {
                return api.PatchArticle(data.id, { title: data.title, starred: data.is_starred, archive: data.is_archived, tags: data.tagList })
                .then(data => cache.set(key, cutArticle(data)))
                .then(a => { dirtyCache.clear(key); });
            }
        }
    }
    return data;
}

function cutArticle (data) {
    return Object.assign({}, {
        id: data.id,
        is_starred: data.is_starred,
        is_archived: data.is_archived,
        title: data.title,
        url: data.url,
        tags: data.tags,
        domain_name: data.domain_name,
        preview_picture: data.preview_picture
    });
}

function moveToDirtyCache (url) {
    if (cache.check(url)) {
        let art = cache.get(url);
        // api.data.Debug && console.log(`article to move to dirtyCache ${JSON.stringify(art)}`);
        dirtyCacheSet(url, {
            title: art.title,
            tagList: art.tags.map(tag => tag.label).join(','),
            is_archived: art.is_archived,
            is_starred: art.is_starred
        });
        cache.clear(url);
    }
}

function savePageToWallabag (url, resetIcon) {
    if (isServicePage(url)) {
        return;
    }
    // if WIP and was some dirty changes, return dirtyCache
    let exists = existCache.check(url) ? existCache.get(url) : existStates.notexists;
    if (exists === existStates.wip) {
     if (dirtyCache.check(url)) {
            let dc = dirtyCache.get(url);
         postIfConnected({ response: 'article', article: cutArticle(dc) });
        }
        return;
    }

    // if article was saved, return cache
    if (cache.check(url)) {
        postIfConnected({ response: 'article', article: cutArticle(cache.get(url)) });
        moveToDirtyCache(url);
     savePageToWallabag(url, resetIcon);
        return;
    }

    // real saving
    browserIcon.set('wip');
    existCache.set(url, existStates.wip);
    postIfConnected({ response: 'info', text: 'Saving the page to wallabag ...' });
    api.SavePage(url)
            .then(data => applyDirtyCacheLight(url, data))
            .then(data => {
                if (!data.deleted) {
                    browserIcon.set('good');
                    postIfConnected({ response: 'article', article: cutArticle(data) });
                    cache.set(url, cutArticle(data));
                    saveExistFlag(url, existStates.exists);
                    if (api.data.AllowExistCheck === false || resetIcon) {
                        browserIcon.timedToDefault();
                    }
                } else {
                    cache.clear(url);
                }
                return data;
            })
            .then(data => applyDirtyCacheReal(url, data))
            .catch(error => {
                browserIcon.setTimed('bad');
                saveExistFlag(url, existStates.notexists);
                throw error;
            });
};

const checkExist = (url) => {
    if (isServicePage(url)) { return; }
    if (existCache.check(url)) {
        const existsFlag = existCache.get(url);
        if (existsFlag === existStates.exists) {
            browserIcon.set('good');
        }
        if (existsFlag === existStates.wip) {
            browserIcon.set('wip');
        }
    } else {
        requestExists(url);
    }
};

const requestExists = (url) =>
        api.EntryExists(url)
        .then(data => {
            let icon = 'default';
            if (data.exists) {
                icon = 'good';
                if (api.data.AllowExistCheck === false) {
                    browserIcon.setTimed(icon);
                }
            }
            browserIcon.set(icon);
            saveExistFlag(url, data.exists ? existStates.exists : existStates.notexists);
            return data.exists;
        });

const saveExistFlag = (url, exists) => {
    existCache.set(url, exists);
};

const isServicePage = (url) => RegExp('((chrome|about|browser|ms-browser-extension):(.*)|' + api.data.Url + ')', 'g').test(url);

const addToAllTags = (tags) => {
    if (tags.length === 0) { return; }
    if (!cache.check('allTags')) {
        cache.set('allTags', tags);
    } else {
        const allTags = cache.get('allTags');
        for (const tag of tags) {
            const index = allTags.map(t => t.label).indexOf(tag.label);
            if (index === -1) {
                // add new tags
                allTags.push(tag);
            } else if ((tag.id > 0) && (allTags[index].id < 0)) {
                // replace dirty tags by clean ones
                allTags.splice(index, 1, tag);
            }
        };
        cache.set('allTags', allTags);
    }
};

const addDirtyToAllTags = (tagList) => {
    if (!tagList || tagList === '') { return; }
    let dirtyId = -1;
    const dirtyTags = tagList.split(',').map(label => Object.assign({}, {id: dirtyId--, label: label, slug: label}));
    addToAllTags(dirtyTags);
};
