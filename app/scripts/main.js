/* global FastClick:false */
/* global moment:false */
/* global Dropbox:false */
/* global Bloodhound:false */
/* global LZString:false */
/* global ScrollFix:false */
/* global templates:false */
/* global D:false */
'use strict';

if (window.navigator.standalone) {
    $(document.body).css('margin-top', '20px');
    $('meta[name="apple-mobile-web-app-status-bar-style"]').remove();
}

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

var swiper = {
    triggerOnTouchEnd: true,
    allowPageScroll: 'vertical',
    speed: 100
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
    init: function() {
        FastClick.attach(document.body);

        var scrollable = document.getElementById('scrollable');
        new ScrollFix(scrollable);
        var timer;
        $(scrollable).scroll(function() {
            $('#google-adsense').hide();
            clearTimeout(timer);
            timer = setTimeout(function() {
                $('#google-adsense').fadeIn();
            },150);
        });

        swiper.swipeStatus = TrackulaApp.onSwipe;

        TrackulaApp.resetDatetime();
        $('form').submit(TrackulaApp.onSubmit);
        $('.swipable').swipe(swiper);

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
                TrackulaApp.actions[id] = {
                    a: record.get('action'),
                    v: record.get('value'),
                    t: record.get('timestamp')
                };
                D.log('sync external insert');
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
                        TrackulaApp.table.get(id).deleteRecord();
                    } else {
                        if (action.edited) {
                            if (action.a === record.get('action') &&
                                action.v === record.get('value') &&
                                action.t === record.get('timestamp')) {
                                delete TrackulaApp.actions[id].unsynced;
                                delete TrackulaApp.actions[id].edited;
                                D.log('sync successful edit');
                            } else {
                                D.log('sync retrying edit');
                                TrackulaApp.table.get(id).update({
                                    action: action.a,
                                    value: Dropbox.Datastore.int64(action.v),
                                    timestamp: Dropbox.Datastore.int64(action.t)
                                });
                            }
                        } else {
                            TrackulaApp.actions[record.getId()] = {
                                a: record.get('action'),
                                v: record.get('value'),
                                t: record.get('timestamp')
                            };
                            D.log('sync successful insert');
                        }
                    }
                } else {
                    D.log('sync external change');
                    TrackulaApp.actions[record.getId()] = {
                        a: record.get('action'),
                        v: record.get('value'),
                        t: record.get('timestamp')
                    };
                }
            } else {
                if (action.inserted) {
                    D.log('sync retrying insert');
                    delete TrackulaApp.actions[id];

                    var newRecord = TrackulaApp.table.insert({
                        action: action.a,
                        value: Dropbox.Datastore.int64(action.v),
                        timestamp: Dropbox.Datastore.int64(action.t)
                    });
                    TrackulaApp.actions[newRecord.getId()] = {
                        a: newRecord.get('action'),
                        v: newRecord.get('value'),
                        t: newRecord.get('timestamp'),
                        inserted: true,
                        unsynced: true
                    };
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
        $('#datetime').val(moment().format('YYYY-MM-DDTHH:mm'));
    },
    insertAction: function(action, value, timestamp) {
        if (TrackulaApp.isOffline()) {
            TrackulaApp.actions[guid()] = {
                a: action,
                v: value,
                t: timestamp.unix(),
                unsynced: true,
                inserted: true
            };
            D.log('inserted action offline');
        } else {
            var record = TrackulaApp.table.insert({
                action: action,
                value: Dropbox.Datastore.int64(value),
                timestamp: Dropbox.Datastore.int64(timestamp.unix())
            });
            TrackulaApp.actions[record.getId()] = {
                a: record.get('action'),
                v: record.get('value'),
                t: record.get('timestamp'),
                inserted: true,
                unsynced: true
            };
            D.log('inserted action (temp)online');
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    editAction: function(id, obj) {
        var action = TrackulaApp.actions[id];
        if ('action' in obj) {
            action.a = obj.action;
        }
        if ('value' in obj) {
            action.v = obj.value;
        }
        if ('timestamp' in obj) {
            action.t = obj.timestamp.unix();
        }
        action.edited = true;
        action.unsynced = true;
        TrackulaApp.actions[id] = action;
        if (!TrackulaApp.isOffline()) {
            TrackulaApp.table.get(id).update({
                action: action.a,
                value: Dropbox.Datastore.int64(action.v),
                timestamp: Dropbox.Datastore.int64(action.t)
            });
            D.log('edited action (temp)online');
        } else {
            D.log('edited action offline');
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    deleteAction: function(id) {
        TrackulaApp.actions[id].deleted = true;
        TrackulaApp.actions[id].unsynced = true;

        if (!TrackulaApp.isOffline()) {
            TrackulaApp.table.get(id).deleteRecord();
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

        $('.swipable').swipe(swiper);

        D.log('listed actions');
    },
    onSubmit: function(ev) {
        ev.preventDefault();
        var timestamp = moment($('#datetime').val());
        var action = $('#action-input').val();
        var value = $('#value-input').val();

        TrackulaApp.insertAction(action, value, timestamp);

        $('#action-input').val('');
        $('#datetime').val(moment().format('YYYY-MM-DDTHH:mm'));
    },
    onSwipe: function(event, phase, direction, distance) {
        var self = event.currentTarget;
        //If we are moving before swipe, and we are going L or R, then manually drag the images
        if (phase === 'move' && (direction === 'left' || direction === 'right')) {
            var duration = 0;

            if (direction === 'left') {
                TrackulaApp.scrollListItems($(self), 0 + distance, duration);
            } else if (direction === 'right') {
                TrackulaApp.scrollListItems($(self), 0 - distance, duration);
            }
        }

        //Else, cancel means snap back to the begining
        else if (phase === 'cancel') {
            TrackulaApp.scrollListItems($(self), 0, swiper.speed);
        }

        //Else end means the swipe was completed, so move to the next image
        else if (phase === 'end') {
            TrackulaApp.scrollListItems($(self), 0, swiper.speed);

            var id = $(self).attr('data-record-id');
            if (direction === 'left') {
                var right = $(self).find('.right');
                if (distance > parseInt(right.css('width'))) {
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
            } else if (direction === 'right') {
                var left = $(self).find('.left');
                if (distance > parseInt(left.css('width'))) {
                    $('.ew-content').css('filter', 'blur(10px)');
                    $('.ew-content').css('-webkit-filter', 'blur(10px)');
                    Dialog.show('Edit Action', templates.editcontrols(TrackulaApp.actions[id]), 'Yes. Change it.', 'No. Cancel.', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeIn();

                        var timestamp = moment($('#dialog #datetime').val());
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
        }
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