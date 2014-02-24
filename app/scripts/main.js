/* global FastClick:false */
/* global moment:false */
/* global Dropbox:false */
/* global Bloodhound:false */
/* global LZString:false */
/* global ScrollFix:false */
/* global templates:false */
/* global saveAs:false */
/* global D:false */
'use strict';

if (window.navigator.standalone) {
    $(document.body).css('margin-top', '20px');
    $('meta[name="apple-mobile-web-app-status-bar-style"]').remove();
}

window.onblur = function() {
    console.log('blur');
};
window.onfocus = function() {
    console.log('focus');
};
window.onpagehide = function() {
    console.log('pagehide');
};
window.onpageshow = function() {
    console.log('pageshow');
};

// $(window).blur(function() {
//     console.log('blur');
// });
// $(window).focus(function() {
//     console.log('focus');
// });
// $(window).on('pagehide', function() {
//     console.log('pagehide');
// });
// $(window).on('pageshow', function() {
//     console.log('pageshow');
// });


function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
}

function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

moment.lang('en', {
    calendar: {
        lastDay: '[Yesterday at] LT',
        sameDay: '[Today at] LT',
        nextDay: '[Tomorrow at] LT',
        lastWeek: '[last] dddd [at] LT',
        nextWeek: 'dddd [at] LT',
        sameElse: 'L [at] LT'
    }
});

var client = new Dropbox.Client({
    key: '3kvwzf94d0wkxwz'
});

var Dialog = Dialog || {
    init: function() {

    },
    show: function(title, message, yes, no, yesCallback, noCallback) {
        var dialog = $('#dialog');
        dialog.find('#title').text(title);
        dialog.find('#message').html(message);
        dialog.find('#yes').text(yes).unbind('click').click(function(ev) {
            ev.preventDefault();
            dialog.hide();
            yesCallback();
        });
        dialog.find('#no').text(no).unbind('click').click(function(ev) {
            ev.preventDefault();
            dialog.hide();
            noCallback();
        });
        dialog.show();
    }
};

var bloodhound = new Bloodhound({
    datumTokenizer: function(d) {
        return Bloodhound.tokenizers.whitespace(d.val);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    local: []
});
bloodhound.initialize();

var TrackulaApp = TrackulaApp || {
    actions: null,
    table: null,
    local: {
        create: function(id, action, value, timestamp, local) {
            var obj = {
                a: action,
                v: value,
                t: timestamp
            };

            if (local) {
                obj.unsynced = true;
                obj.inserted = true;
            }

            TrackulaApp.actions[id] = obj;

            return TrackulaApp.actions[id];
        },
        update: function(id, action, value, timestamp, local) {
            var obj = TrackulaApp.actions[id];
            if (action) {
                obj.a = action;
            }
            if (value) {
                obj.v = value;
            }
            if (timestamp) {
                obj.t = timestamp;
            }

            if (local) {
                obj.unsynced = true;
                obj.edited = true;
            }

            TrackulaApp.actions[id] = obj;

            return TrackulaApp.actions[id];
        },
        delete: function(id) {
            TrackulaApp.actions[id].deleted = true;
            TrackulaApp.actions[id].unsynced = true;

            return TrackulaApp.actions[id];
        },
    },
    remote: {
        create: function(action, value, timestamp) {
            return TrackulaApp.table.insert({
                action: action,
                value: Dropbox.Datastore.int64(value),
                timestamp: Dropbox.Datastore.int64(timestamp.unix())
            });
        },
        update: function(id, action, value, timestamp) {
            var obj = {};
            if (action) {
                obj.action = action;
            }
            if (value) {
                obj.value = Dropbox.Datastore.int64(value);
            }
            if (timestamp) {
                obj.value = Dropbox.Datastore.int64(timestamp);
            }

            return TrackulaApp.table.get(id).update(obj);
        },
        delete: function(id) {
            return TrackulaApp.table.get(id).deleteRecord();
        }
    },
    init: function() {
        FastClick.attach(document.body);

        var scrollable = document.getElementById('scrollable');
        new ScrollFix(scrollable);
        var adsense = $('#google-adsense');
        var timer;
        $(scrollable).scroll(function() {
            setTimeout(function() {
                adsense.hide();
                clearTimeout(timer);
                timer = setTimeout(function() {
                    adsense.fadeIn();
                }, 300);
            }, 0);
        });

        $('#export-link').click(function() {
            var csvContent = [];
            csvContent.push('id;action;value;timestamp');
            for (var id in TrackulaApp.actions) {
                var action = TrackulaApp.actions[id];
                csvContent.push(id + ';' + action.a + ';' + action.v + ';' + action.t);
            }

            csvContent = csvContent.join('\n');
            var blob = new Blob([csvContent], {
                type: 'text/csv;charset=utf-8'
            });
            saveAs(blob, 'quanticula--'+moment().format('YYYY-MM-DD--HH-mm-ss') + '.csv');
        });

        TrackulaApp.resetDatetime();
        $('form').submit(TrackulaApp.onSubmit);
        TrackulaApp.bindSwipable();

        $('#action-input').focus(function() {
            $('#suggestions').show();
            $('#actionlist').hide();
        });
        $('#action-input').keyup(function() {
            bloodhound.get($(this).val(), function(suggestions) {
                $('#suggestions').empty();
                suggestions.forEach(function(suggestion) {
                    var li = $('<li>' + suggestion.val + '</li>');
                    li.mousedown(function() {
                        $('#action-input').val($(this).text());
                    });
                    li.bind('touchstart', function() {
                        $('#action-input').val($(this).text());
                    });
                    $('#suggestions').prepend(li);
                });
            });
        });

        $('#action-input').blur(function() {
            $('#actionlist').show();
            $('#suggestions').hide();
        });

        TrackulaApp.actions = {};
        var storedActions = localStorage.getItem('quanticula-actions');
        if (storedActions !== null) {
            storedActions = LZString.decompressFromUTF16(storedActions);
            try {
                storedActions = JSON.parse(storedActions);
                TrackulaApp.actions = storedActions;
                D.log('loaded actions from localstorage');
            } catch (e) {}
        }

        TrackulaApp.listActions();

        // Try and authenticate the client, without redirecting the user
        client.authenticate({
            interactive: false
        }, function(error) {
            if (error) {
                D.log('OAuth error (interactive:false): ' + error);
            }
        });

        TrackulaApp.checkClient();
    },
    checkClient: function() {
        if (client.isAuthenticated()) {
            client.getDatastoreManager().openDefaultDatastore(function(error, Datastore) {
                if (error) {
                    D.log('Datastore error: ' + error);
                }
                D.log('opened datastore');
                TrackulaApp.table = Datastore.getTable('actions');
                TrackulaApp.sync();
                //Datastore.recordsChanged.addListener(TrackulaApp.recordsChanged);
            });
        } else {
            client.authenticate({}, function(error) {
                if (error) {
                    console.log('OAuth error (interactive:true): ' + error);
                }
            });
        }
    },
    isOffline: function() {
        return TrackulaApp.table ? true : false;
    },
    sync: function() {
        var id, record;
        var records = TrackulaApp.table.query();

        var recordsMap = {};
        for (var i = records.length - 1; i >= 0; i--) {
            record = records[i];
            id = record.getId();
            recordsMap[id] = records[i];

            if (!(id in TrackulaApp.actions)) {
                TrackulaApp.local.create(id, record.get('action'), record.get('value'), record.get('timestamp'), false);
                D.log('sync external create');
            }
        }

        for (id in TrackulaApp.actions) {
            var action = TrackulaApp.actions[id];
            if (id in recordsMap) {
                record = recordsMap[id];
                if (action.unsynced) {
                    D.log('sync previously unsynced action');
                    if (action.deleted) {
                        D.log('sync retrying delete');
                        TrackulaApp.remote.delete(id);
                    } else {
                        if (action.edited) {
                            if (action.a === record.get('action') &&
                                action.v === record.get('value') &&
                                action.t === record.get('timestamp')) {
                                delete TrackulaApp.actions[id].unsynced;
                                delete TrackulaApp.actions[id].edited;
                                D.log('sync successful update');
                            } else {
                                D.log('sync retrying update');
                                TrackulaApp.remote.update(id, action.a, action.v, action.t);
                            }
                        } else {
                            TrackulaApp.local.update(record.getId(), record.get('action'), record.get('value'), record.get('timestamp'), false);
                            D.log('sync successful create');
                        }
                    }
                } else {
                    D.log('sync external update');
                    TrackulaApp.local.update(record.getId(), record.get('action'), record.get('value'), record.get('timestamp'), false);
                }
            } else {
                if (action.inserted) {
                    D.log('sync retrying create');

                    // if the action was created while offline it will still have a temporary guid
                    // since we are now definitly at least semi-online we can get a true dropbox id
                    // so in order to exchange the id we need to completely delete the old key
                    // in the associative array
                    delete TrackulaApp.actions[id];

                    record = TrackulaApp.remote.create(action.a, action.v, action.t);
                    TrackulaApp.local.create(record.getId(), action.a, action.v, action.t, true);
                } else {
                    D.log('sync successful delete');
                    delete TrackulaApp.actions[id];
                }
            }
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    resetDatetime: function() {
        // set default datetime to now
        $('#timestamp-input').val(moment().format('YYYY-MM-DDTHH:mm'));
    },
    insertAction: function(action, value, timestamp) {
        if (TrackulaApp.isOffline()) {
            TrackulaApp.local.create(guid(), action, value, timestamp.unix(), true);
            D.log('inserted action offline');
        } else {
            var record = TrackulaApp.remote.create(action, value, timestamp.unix());
            TrackulaApp.local.create(record.getId(), action, value, timestamp.unix(), true);
            D.log('inserted action (temp)online');
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    editAction: function(id, obj) {
        var action = TrackulaApp.local.update(id, obj.action, obj.value, obj.timestamp.unix(), true);

        if (!TrackulaApp.isOffline()) {
            TrackulaApp.remote.update(id, action.a, action.v, action.t);
            D.log('edited action (temp)online');
        } else {
            D.log('edited action offline');
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    deleteAction: function(id) {
        TrackulaApp.local.delete(id);

        if (!TrackulaApp.isOffline()) {
            TrackulaApp.remote.delete(id);
            D.log('deleted action (temp)online');
        } else {
            D.log('deleted action offline');
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    listActions: function() {
        var list = $('#actionlist');
        list.empty();

        var sortByTimestamp = [];
        for (var id in TrackulaApp.actions) {
            if (TrackulaApp.actions.hasOwnProperty(id)) {
                sortByTimestamp.push({
                    id: id,
                    timestamp: TrackulaApp.actions[id].t
                });
            }
        }

        sortByTimestamp = sortByTimestamp.sort(function(a, b) {
            return a.timestamp - b.timestamp;
        });

        var predictions = [];
        for (var i = sortByTimestamp.length - 1; i >= 0; i--) {
            id = sortByTimestamp[i].id;
            var record = TrackulaApp.actions[id];
            if (!record.deleted) {
                list.append(templates.listitem(id, record.a, record.v, record.t * 1000));

                if (!(record.a in predictions)) {
                    predictions[record.a] = 0;
                }
            }
        }

        bloodhound = new Bloodhound({
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.val);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: Object.keys(predictions).map(function(a) {
                return {
                    val: a
                };
            })
        });
        bloodhound.initialize();

        TrackulaApp.bindSwipable();
        D.log('listed actions');
    },
    onSubmit: function(ev) {
        ev.preventDefault();
        var timestamp = moment($('#timestamp-input').val());
        var action = $('#action-input').val();
        var value = $('#value-input').val();

        TrackulaApp.insertAction(action, value, timestamp);

        $('#action-input').val('');
        $('#timestamp-input').val(moment().format('YYYY-MM-DDTHH:mm'));
    },
    bindSwipable: function() {
        var swipable = $('.swipable').hammer({
            drag_block_horizontal: true, // jshint ignore:line
            drag_lock_to_axis: true, // jshint ignore:line
        });

        var isSwiping = false;
        swipable.on('dragleft dragright', function(ev) {
            TrackulaApp.scrollListItems($(ev.currentTarget), -ev.gesture.deltaX, 0);
            isSwiping = true;
        });
        swipable.on('dragend', function(ev) {
            if (!isSwiping) {
                return;
            }
            isSwiping = false;
            var target = $(ev.currentTarget);
            TrackulaApp.scrollListItems(target, 0, 100);

            var distance = ev.gesture.deltaX;

            var id = target.attr('data-record-id');
            if (distance < 0) {
                var right = target.find('.right');
                if (Math.abs(distance) > parseInt(right.css('width'))) {
                    $('.ew-content').css('filter', 'blur(10px)');
                    $('.ew-content').css('-webkit-filter', 'blur(10px)');
                    $('.ew-content').fadeTo(0, 0.2);
                    Dialog.show('Delete Action', 'Are you sure you want to delete this action?', 'Yes. Delete it.', 'No. Cancel.', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeTo(0, 1.0);

                        TrackulaApp.deleteAction(id);
                    }, function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeTo(0, 1.0);
                    });
                }
            } else if (distance > 0) {
                var left = target.find('.left');
                if (Math.abs(distance) > parseInt(left.css('width'))) {
                    $('.ew-content').css('filter', 'blur(10px)');
                    $('.ew-content').css('-webkit-filter', 'blur(10px)');
                    Dialog.show('Edit Action', templates.editcontrols(TrackulaApp.actions[id]), 'Yes. Change it.', 'No. Cancel.', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeIn();

                        var timestamp = moment($('#dialog #timestamp-input').val());
                        var action = $('#dialog #action-input').val();
                        var value = $('#dialog #value-input').val();

                        TrackulaApp.editAction(id, {
                            action: action,
                            value: value,
                            timestamp: timestamp
                        });
                    }, function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeIn();
                    });
                }
            }
        });
    },
    scrollListItems: function(target, distance, duration) {
        target.css('-transition-duration', (duration / 1000).toFixed(1) + 's');

        //inverse the number we set in the css
        var value = (distance < 0 ? '' : '-') + Math.abs(distance).toString();

        target.css('-transform', 'translate3d(' + value + 'px,0px,0px)');

        var width;
        if (distance < 0) {
            var left = target.find('.left');
            width = parseInt(left.css('width'));
            left.css('color', 'rgba(255,255,255,' + (Math.abs(distance) / width).toString() + ')');
            if (Math.abs(distance) > width) {
                target.parent().css('background-color', '#34aadc');
            } else {
                target.parent().css('background-color', '#d2d6d6');
            }
        } else if (distance > 0) {
            var right = target.find('.right');
            width = parseInt(right.css('width'));
            right.css('color', 'rgba(255,255,255,' + (Math.abs(distance) / width).toString() + ')');
            if (Math.abs(distance) > width) {
                target.parent().css('background-color', '#ff3b30');
            } else {
                target.parent().css('background-color', '#d2d6d6');
            }
        }
    }
};

$('document').ready(TrackulaApp.init);