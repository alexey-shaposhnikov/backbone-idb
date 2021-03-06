/**
 * @license
 * Backbone IndexedDB Adapter
 * Version 0.2.6
 * Copyright (c) 2013-2014 Vincent Mac
 *
 * Available under MIT license <https://raw.github.com/vincentmac/backbone-idb/master/LICENSE>
 *
 * http://github.com/vincentmac/backbone-idb
 */
;(function (global, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof require === 'function') {
    // CommonJS Module - Register as a CommonJS Module 
    module.exports = factory(require('underscore'), require('backbone'), require('idb-wrapper'), require('jquery'), global);
  } else if (typeof define === 'function' && define.amd) {
    // AMD - Register as an anonymous module
    define(['underscore', 'backbone', 'jquery'], function(_, Backbone, $) {
      return factory(_ || global._, Backbone || global.Backbone, IDBStore || global.IDBStore, $ || global.$, 'AMD');
    });
  } else {
    factory(_, Backbone, IDBStore, $ || jQuery, global);
  }
}(global || window, function(_, Backbone, IDBStore, $, global) {
  'use strict';

  // // Generate four random hex digits.
  // function S4() {
  //   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  // }

  // // Generate a pseudo-GUID by concatenating random hexadecimal.
  // function guid() {
  //   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
  // }
  var defaultErrorHandler = function (error) {
    throw error;
  };

  var noop = function () {
  };


  Backbone.IndexedDB = function IndexedDB(options, parent) {
    var that = this;
    this.parent = parent;  // reference to the model or collection

    var defaultReadyHandler = function () {
      // console.log('idb:ready this:', this);  // <IDBStore>
      // console.log('idb:ready that:', that);  // <IndexedDB>
      
      // By default, make the Backbone.IndexedDB available through `parent.indexedDB`
      // that.parent.indexedDB = that;
      // Fire ready event on parent model or collection
      that.parent.trigger('idb:ready', that);
    };

    var defaults = {
      storeName: 'Store',
      storePrefix: '',
      dbVersion: 1,
      keyPath: 'id',
      autoIncrement: true,
      onStoreReady: defaultReadyHandler,
      onError: defaultErrorHandler,
      indexes: []
    };

    options = _.defaults(options || {}, defaults);
    this.dbName = options.storePrefix + options.storeName;
    this.store = new IDBStore(options);
    this.keyPath = options.keyPath;
  };

  // _.extend(Backbone.IndexedDB.prototype, {
  Backbone.IndexedDB.prototype = {

    /**
     * The version of Backbone.IndexedDB
     *
     * @type String
     */
    version: '0.2.10',

    /**
     * Add a new model to the store
     *
     * @param {Backbone.Model} model - Backbone model to add to store
     * @param {Object} options - sync options created by Backbone
     * @param {Function} [options.success] - overridable success callback 
     * @param {Function} [options.error] - overridable error callback
     */
    create: function(model, options) {
      var data = model.attributes;
      var that = this;
      this.store.put(data, function(insertedId) {
        data[that.keyPath] = insertedId;
        options.success(data)
      }, options.error);

    },

    /**
     * Update a model in the store
     *
     * @param {Backbone.Model} model - Backbone model to update and save to store
     * @param {Object} options - sync options created by Backbone
     * @param {Function} [options.success] - overridable success callback 
     * @param {Function} [options.error] - overridable error callback
     */
    update: function(model, options) {
      this.store.put(model.attributes, options.success, options.error);
    },

    /**
     * Retrieve a model from the store
     *
     * @param {Backbone.Model} model - Backbone model to get from store
     * @param {Object} options - sync options created by Backbone
     * @param {Function} [options.success] - overridable success callback 
     * @param {Function} [options.error] - overridable error callback
     */
    read: function(model, options) {
      this.store.get(model.id, options.success, options.error);
    },

    /**
     * Retrieve a collection from the store
     *
     * @param {Object} options - sync options created by Backbone
     * @param {Function} [options.success] - overridable success callback 
     * @param {Function} [options.error] - overridable error callback
     */
    getAll: function(options) {
      this.store.getAll(options.success, options.error);
    },

    /**
     * Delete a model from the store
     *
     * @param {Backbone.Model} model - Backbone model to delete from store
     * @param {Object} options - sync options created by Backbone
     * @param {Function} [options.success] - overridable success callback 
     * @param {Function} [options.error] - overridable error callback
     */
    destroy: function(model, options) {
      if (model.isNew()) {
        return false;
      }

      this.store.remove(model.id, options.success, options.error);
    },

    /**
     * Iterates over the store using the given options and calling onItem
     * for each entry matching the options.
     *
     * @param {Function} onItem - A callback to be called for each match
     * @param {Object} [options] - An object defining specific options
     * @param {Object} [options.index=null] - An IDBIndex to operate on
     * @param {String} [options.order=ASC] - The order in which to provide the
     *  results, can be 'DESC' or 'ASC'
     * @param {Boolean} [options.autoContinue=true] - Whether to automatically
     *  iterate the cursor to the next result
     * @param {Boolean} [options.filterDuplicates=false] - Whether to exclude
     *  duplicate matches
     * @param {Object} [options.keyRange=null] - An IDBKeyRange to use
     * @param {Boolean} [options.writeAccess=false] - Whether grant write access
     *  to the store in the onItem callback
     * @param {Function} [options.onEnd=null] - A callback to be called after
     *  iteration has ended
     * @param {Function} [options.onError=throw] - A callback to be called
     *  if an error occurred during the operation.
     */
    iterate: function(onItem, options) {
      if (options.keyRange && !(options.keyRange instanceof global.IDBKeyRange)) {
        options.keyRange = this.makeKeyRange(options.keyRange);
      }

      this.store.iterate(onItem, options);
    },

    /**
     * Creates a key range using specified options. This key range can be
     * handed over to the count() and iterate() methods.
     *
     * Note: You must provide at least one or both of "lower" or "upper" value.
     *
     * @param {Object} options The options for the key range to create
     * @param {*} [options.lower] The lower bound
     * @param {Boolean} [options.excludeLower] Whether to exclude the lower
     *  bound passed in options.lower from the key range
     * @param {*} [options.upper] The upper bound
     * @param {Boolean} [options.excludeUpper] Whether to exclude the upper
     *  bound passed in options.upper from the key range
     * @param {*} [options.only] A single key value. Use this if you need a key
     *  range that only includes one value for a key. Providing this
     *  property invalidates all other properties.
     * @return {Object} The IDBKeyRange representing the specified options
     */
    makeKeyRange: function(options) {
      return this.store.makeKeyRange(options);
    },

    /**
     * Perform a batch operation to save all models in the current collection to indexedDB.
     *
     * @param {Function} [onSuccess] - success callback 
     * @param {Function} [onError] - error callback
     */
    saveAll: function(onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      onError || (onError = defaultErrorHandler);

      this.store.putBatch(this.parent.toJSON(), onSuccess, onError);
    },

    /**
     * Perform a batch operation to save and/or remove models in the current collection to
     * indexedDB. This is a proxy to the idbstore `batch` method
     *
     * @param {Array} dataArray - Array of objects containing the operation to run and
     *  the model (for put operations).
     * @param {Function} [onSuccess] - success callback 
     * @param {Function} [onError] - error callback
     */
    batch: function(dataArray, onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      onError || (onError = defaultErrorHandler);

      this.store.batch(dataArray, onSuccess, onError);
    },

    /**
     * Perform a batch put operation to save models to indexedDB. This is a 
     * proxy to the idbstore `putBatch` method
     *
     * @param {Array} dataArray - Array of models (in JSON) to store
     * @param {Function} [onSuccess] - success callback 
     * @param {Function} [onError] - error callback
     */
    putBatch: function(dataArray, onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      onError || (onError = defaultErrorHandler);

      this.store.putBatch(dataArray, onSuccess, onError);
    },

    /**
     * Perform a batch operation to remove models from indexedDB. This is a 
     * proxy to the idbstore `removeBtch` method
     *
     * @param {Array} keyArray - keyArray An array of keys to remove
     * @param {Function} [onSuccess] - success callback 
     * @param {Function} [onError] - error callback
     */
    removeBatch: function(keyArray, onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      onError || (onError = defaultErrorHandler);

      this.store.removeBatch(keyArray, onSuccess, onError);
    },

    /**
     * Clears all content from the current indexedDB for this collection/model
     *
     * @param {Function} [onSuccess] - success callback 
     * @param {Function} [onError] - error callback
     */
    clear: function(onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      onError || (onError = defaultErrorHandler);

      this.store.clear(onSuccess, onError);
    },

    /**
     * Deletes the current indexedDB for this collection/model
     */
    deleteDatabase: function() {
      this.store.deleteDatabase();
    }

  // });
  };


  /**
   * Backbone.sync drop-in replacement
   *
   * This function replaces the model or collection's sync method and remains
   * compliant with Backbone's api.
   */
  Backbone.IndexedDB.sync = Backbone.idbSync = function(method, model, options) {
    var deferred = new $.Deferred();
    var db = model.indexedDB || model.collection.indexedDB;
    // console.log('Backbone.IndexedDB.sync', method, model, options);
    var success = options.success || noop;
    var error = options.success || noop;
    options.success = function (result) {
      success.apply(this, arguments);
      deferred.resolve(result);
    };
    options.error = function (result) {
      error.apply(this, arguments);
      deferred.reject(result);
    };
    switch (method) {

      // Retrieve an individual model or entire collection from indexedDB
      case 'read':
        model.id !== undefined ? db.read(model, options) : db.getAll(options);
        break;

      case 'create':
        if (model.id) {
          db.update(model, options);
        } else {
          db.create(model, options);
        }
        break;

      case 'update':
        if (model.id) {
          db.update(model, options);
        } else {
          db.create(model, options);
        }
        break;

      case 'delete':
        if (model.id) {
          db.destroy(model, options);
        }
        break;
    }
    return deferred.promise();

  };

  // Reference original `Backbone.sync`
  Backbone.ajaxSync = Backbone.sync;

  Backbone.getIDBSyncMethod = function(model) {
    if(model.indexedDB || (model.collection && model.collection.indexedDB)) {
      return Backbone.idbSync;
    }

    return Backbone.ajaxSync;
  };

  // Override 'Backbone.sync' to default to idbSync,
  // the original 'Backbone.sync' is still available in 'Backbone.ajaxSync'
  Backbone.sync = function(method, model, options) {
    return Backbone.getIDBSyncMethod(model).apply(this, [method, model, options]);
  };

  Backbone.IndexedDB.version = Backbone.IndexedDB.prototype.version;

  return Backbone.IndexedDB;
}));