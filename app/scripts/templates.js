/* global moment:false */
/*jshint unused:false */
'use strict';

var templates = {
    listitem: function(id, action, value, timestamp) {
        var html = '<li class="swipable" data-record-id="' + id + '">' +
            '<span class="left">pencil</span>' +
            '<div class="center">' +
            '<span class="action">' + action + '</span>' +
            '<span class="value">' + value + '</span>' +
            '<span class="timestamp">' + moment(timestamp).calendar() + '</span>' +
            '<span class="right">cancel</span>' +
            '</li>';
        return html;
    },
    editcontrols: function(r) {
        var html = '<input id="datetime" type="datetime-local" class="ew-input" step="60" value="' + moment(r.t*1000).format('YYYY-MM-DDTHH:mm') + '">' +
            '<input id="action-input" type="text" class="ew-input" placeholder="action" value="' + r.a + '" required>' +
            '<input id="value-input" type="text" class="ew-input" placeholder="value" value="' + r.v + '">';
        return html;
    }
};
