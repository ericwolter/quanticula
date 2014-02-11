/* global FastClick:false */
/* global moment:false */
/* global Dropbox:false */
/* global Bloodhound:false */
/* global LZString:false */
/* global ScrollFix:false */
/* global templates:false */
'use strict';

if (window.navigator.standalone) {
    $(document.body).css('margin-top', '20px');
    $('meta[name="apple-mobile-web-app-status-bar-style"]').remove();
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
            } catch (e) {}
        }

        TrackulaApp.listActions();

        // Try and authenticate the client, without redirecting the user
        client.authenticate({
            interactive: false
        }, function(error) {
            if (error) {
                console.log('OAuth error (interactive:false): ' + error);
            }
        });

        TrackulaApp.checkClient();
    },
    checkClient: function() {
        if (client.isAuthenticated()) {
            client.getDatastoreManager().openDefaultDatastore(function(error, Datastore) {
                if (error) {
                    console.log('Datastore error: ' + error);
                }
                TrackulaApp.table = Datastore.getTable('actions');
                TrackulaApp.sync();
                Datastore.recordsChanged.addListener(TrackulaApp.recordsChanged);
            });
        } else {
            client.authenticate({}, function(error) {
                if (error) {
                    console.log('OAuth error (interactive:true): ' + error);
                }
            });
        }
    },
    sync: function() {
        var records = TrackulaApp.table.query();
        for (var i = records.length - 1; i >= 0; i--) {
            var record = records[i];
            TrackulaApp.actions[record.getId()] = {
                a: record.get('action'),
                v: record.get('value'),
                t: record.get('timestamp')
            };
        }
        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
    },
    resetDatetime: function() {
        // set default datetime to now
        $('#datetime').val(moment().format('YYYY-MM-DDTHH:mm'));
    },
    insertAction: function(action, value, timestamp) {
        TrackulaApp.table.insert({
            action: action,
            value: Dropbox.Datastore.int64(value),
            timestamp: Dropbox.Datastore.int64(timestamp.unix())
        });
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
            list.append(templates.listitem(id, record.a, record.v, record.t * 1000));

            if (!(record.a in predictions)) {
                predictions[record.a] = 0;
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
    },
    deleteAction: function(id) {
        delete TrackulaApp.actions[id];
    },
    recordsChanged: function(ev) {
        var affected = ev.affectedRecordsForTable('actions');

        for (var i = affected.length - 1; i >= 0; i--) {
            var record = affected[i];
            if (record.isDeleted()) {
                delete TrackulaApp.actions[record.getId()];
            } else { // insert or update
                TrackulaApp.actions[record.getId()] = {
                    a: record.get('action'),
                    v: record.get('value'),
                    t: record.get('timestamp')
                };
            }
        }

        localStorage.setItem('quanticula-actions', LZString.compressToUTF16(JSON.stringify(TrackulaApp.actions)));
        TrackulaApp.listActions();
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

            console.log(self);

            if (direction === 'left') {
                var right = $(self).find('.right');
                if (distance > parseInt(right.css('width'))) {
                    $('.ew-content').css('filter', 'blur(10px)');
                    $('.ew-content').css('-webkit-filter', 'blur(10px)');
                    $('.ew-content').fadeTo(0, 0.2);
                    // var id = $(self).attr('data-record-id');
                    Dialog.show('Delete Action', 'Are you sure you want to delete this action?', 'Yes. Delete it.', 'No. Cancel.', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeTo(0, 1.0);

                        // console.log('delete: ' + id);
                        // TrackulaApp.actions.get(id).deleteRecord();
                    }, function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeTo(0, 1.0);
                        // console.log('cancel: ' + id);
                    });
                }
            } else if (direction === 'right') {
                var left = $(self).find('.left');
                if (distance > parseInt(left.css('width'))) {
                    $('.ew-content').css('filter', 'blur(10px)');
                    $('.ew-content').css('-webkit-filter', 'blur(10px)');
                    var id = $(self).attr('data-record-id');
                    Dialog.show('Edit Action', templates.editcontrols(TrackulaApp.actions[id]), 'Yes. Change it.', 'No. Cancel.', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        $('.ew-content').fadeIn();

                        var timestamp = moment($('#dialog #datetime').val());
                        var action = $('#dialog #action-input').val();
                        var value = $('#dialog #value-input').val();

                        TrackulaApp.table.get(id).update({
                            action: action,
                            value: Dropbox.Datastore.int64(value),
                            timestamp: Dropbox.Datastore.int64(timestamp.unix())
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