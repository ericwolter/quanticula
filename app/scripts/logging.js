/*jshint unused:false */

'use strict';

var D = {

    // should we log messages to the console
    debug: false,

    // can we log messages to the console
    canLog: (typeof console !== 'undefined' && typeof console.log !== 'undefined'),

    /**
     * Debug aware debugging
     */
    log: function() {
        if (!this.debug || !this.canLog) {
            return;
        }
        console.log.apply(console, arguments);
    }
};