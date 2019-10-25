'use strict';

const path = require("path");
const Datastore = require("nedb");
const config = require('./mtd-config');

module.exports = {
    query: _query,
    store: _storeEntity,
    getOauthConfig: _queryOauthConfig,
    storeOauthConfig: _storeOauthConfig,
    getAppConfig: _queryAppConfig,
    storeAppConfig: _storeAppConfig,
    getTestUsers: _queryTestUsers,
    storeTestUser: _storeTestUser,
    getVatSubmissions: _queryVatSubmissions,
    storeVatSubmission: _storeVatSubmission,
    deleteTestUser: _deleteTestUser
};

function _queryAppConfig(user, cb) {
    return _query(user,'appConfig', cb);
}

function _storeAppConfig(user, appConfig, cb) {
    return _storeEntity(user,'appConfig', appConfig, cb);
}

function _queryOauthConfig(user, cb) {
    return _query(user,'oauth', cb);
}

function _storeOauthConfig(user, oauth, cb) {
    return _storeEntity(user,'oauth', oauth, cb);
}

function _queryTestUsers(user, cb) {
    return _query(user,'testUsers', cb);
}

function _storeTestUser(user, testUser, cb) {
    _storeEntity(user,'testUsers', testUser, cb);
}

function _queryVatSubmissions(user, cb) {
    return _query(user,'vatSubmissions', cb);
}

function _storeVatSubmission(user, vatSubmission, cb) {
    console.log('%s:storeVatSubmission(%s)', user, JSON.stringify(vatSubmission, null, 4));
    _storeEntity(user,'vatSubmissions', vatSubmission, cb);
}

function _deleteTestUser(user, id, cb) {
    return _delete(user,'testUsers', id, (err, numRemoved) => {
        if (err) {
            console.log('Remove failed: ', err);
        }
        return _queryTestUsers(cb);
    });
}

function _getDb(user) {
    if (!user) {
        user = 'guest';
    }

    const dbFile = path.join(config.dataFolder, config.env+"-mtd-"+user+".nedb");
    return new Datastore({ filename: dbFile, autoload: true });
}

function _delete(user, schemaType, id, cb) {
    console.log('Deleting %s/%s/%s', user, schemaType, id);
    var db = _getDb(user);
    db.remove({ type: schemaType, _id: id }, {}, (err,numRemoved) => {
        console.log('Number removed ' + numRemoved);
        cb(err, numRemoved);
    });
}

/**
 * if schemaType ends with 's', return an array, otherwise return a singleton
 * @param schemaType
 * @param cb
 * @returns {*}
 * @private
 */
function _query(user, schemaType, cb) {
    var db = _getDb(user);
    if (cb) {
        return db.find({ type: schemaType }, (err, arr) => {
            if (err) {
                console.log('%s:_query(%s)=>%s', user, schemaType, err);
                cb();
            } else {
                console.log('%s:_query(%s)=>%d entries', user, schemaType, arr.length);
                cb(schemaType.endsWith('s') ? arr : (arr.length > 0 ? arr[0] : null));
            }
        });
    } else {
        return new Promise((resolve, reject) => {
            db.find({ type: schemaType }, (err, arr) => {
                if (err) {
                    console.log('%s:_query(%s)=>%s', user, schemaType, err);
                    reject(err);
                } else {
                    console.log('%s:_query(%s)=>%d entries', user, schemaType, arr.length);
                    resolve(schemaType.endsWith('s') ? arr : (arr.length > 0 ? arr[0] : null));
                }
            });
        });
    }
}

function _storeEntity(user, schemaType, entity, cb) {
    var db = _getDb(user);
    entity.type = schemaType;
    if (schemaType.endsWith('s')) {
        entity.createdAt = new Date();
        if (cb) {
            db.insert(entity, (err1, newEntity) => {
                if (err1) {
                    console.log('%s:1. _store%s() insert error %s: %s', user, schemaType, err1, err1.stack);
                    cb(err1.message);
                } else {
                    console.log('%s: 1. inserted %s %s', user, schemaType, JSON.stringify(newEntity, null, 4));
                    cb(null, newEntity);
                }
            });
        } else {
            return new Promise((resolve, reject) => {
                db.insert(entity, (err1, newEntity) => {
                    if (err1) {
                        console.log('%s:2. _store%s() insert error %s: %s', user, schemaType, err1, err1.stack);
                        reject(err1.message);
                    } else {
                        console.log('%s:2. inserted %s %s', user, schemaType, JSON.stringify(newEntity, null, 4));
                        resolve(newEntity);
                    }
                });
            });
        }
    } else {
        db.find({ type: schemaType },(err, arr) => {
            if (cb) {
                if (err) {
                    console.log('%s:3._store%s() find error %s: %s', user, schemaType, err, err.stack);
                    cb(err.message);
                } else {
                    if (!arr || arr.length == 0) {
                        entity.createdAt = new Date();
                        db.insert(entity, (err1, newEntity) => {
                            if (err1) {
                                console.log('%s:3. _store%s() insert error %s: %s', user, schemaType, err1, err1.stack);
                                cb(err1.message);
                            } else {
                                console.log('%s:3. inserted %s %s', user, schemaType, JSON.stringify(newEntity, null, 4));
                                cb(null, newEntity);
                            }
                        });
                    } else {
                        entity.updatedAt = new Date();
                        db.update(arr[0], entity, (err2, updated) => {
                            if (err2) {
                                console.log('%s:4. _store%s() update error %s: %s', user, schemaType, err2, err2.stack);
                                cb(err2.message);
                            } else {
                                console.log('%s:4. updated %s', user, JSON.stringify(updated, null, 4));
                                cb(null, updated);
                            }
                        });
                    }
                }
            } else {
                return new Promise((resolve, reject) => {
                    if (err) {
                        console.log('%s:5._store%s() error %s: %s', user, schemaType, err, err.stack);
                        reject(err.message);
                    } else {
                        if (!arr || arr.length == 0) {
                            db.insert(entity, (err1, newEntity) => {
                                if (err1) {
                                    console.log('%s:5. _store%s() insert error %s: %s', user, schemaType, err1, err1.stack);
                                    reject(err1.message);
                                } else {
                                    console.log('%s:5. inserted %s %s', user, schemaType, JSON.stringify(newEntity, null, 4));
                                    resolve(newEntity);
                                }
                            });
                        } else {
                            for (var k in entity) {
                                arr[0][k] = entity[k];
                            }
                            db.update(arr[0], arr[0], (err2, updated) => {
                                if (err2) {
                                    console.log('%s:6. _store%s() update error %s: %s', user, schemaType, err2, err2.stack);
                                    reject(err2.message);
                                } else {
                                    console.log('%s:6. updated %s', user, JSON.stringify(updated, null, 4));
                                    resolve(updated);
                                }
                            });
                        }
                    }
                });
            }
        });
    }
}

