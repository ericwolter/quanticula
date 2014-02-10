/* global FastClick:false */
/* global moment:false */
/* global Dropbox:false */
/* global Bloodhound:false */
/* global ScrollFix:false */
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
        dialog.find('#message').text(message);
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

        // Try and authenticate the client, without redirecting the user
        client.authenticate({
            interactive: false
        }, function(error) {
            if (error) {
                console.log('OAuth error: ' + error);
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
                TrackulaApp.actions = Datastore.getTable('actions');

                TrackulaApp.updateActions();
                Datastore.recordsChanged.addListener(TrackulaApp.updateActions);
            });
        } else {
            client.authenticate();
        }
    },
    resetDatetime: function() {
        // set default datetime to now
        $('#datetime').val(moment().format('YYYY-MM-DDTHH:mm'));
    },
    updateActions: function() {
        var list = $('#actionlist');
        var records = TrackulaApp.actions.query();

        list.empty();

        var local = {};

        for (var i = records.length - 1; i >= 0; i--) {
            var record = records[i];

            var html = '<li class="swipable" data-record-id="' + record.getId() + '">' +
                '<span class="left">pencil</span>' +
                '<div class="center">' +
                '<span class="action">' + record.get('action') + '</span>' +
                '<span class="value">' + record.get('value') + '</span>' +
                '<span class="timestamp">' + moment(record.get('timestamp') * 1000).calendar() + '</span>' +
                '<span class="right">cancel</span>' +
                '</li>';

            list.append($(html));

            local[record.get('action')] = 1;
        }

        bloodhound = new Bloodhound({
            datumTokenizer: function(d) {
                return Bloodhound.tokenizers.whitespace(d.val);
            },
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: Object.keys(local).map(function(v) {return {val:v};})
        });
        bloodhound.initialize();

        $('.swipable').swipe(swiper);


    },
    onSubmit: function(ev) {
        ev.preventDefault();
        var datetime = moment($('#datetime').val());
        var action = $('#action-input').val();
        var value = $('#value-input').val();

        TrackulaApp.actions.insert({
            action: action,
            value: Dropbox.Datastore.int64(value),
            timestamp: Dropbox.Datastore.int64(datetime.unix())
        });

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
                    var id = $(self).attr('data-record-id');
                    Dialog.show('Delete Action', 'Are you sure you want to delete this action?', 'Yes. Delete it.', 'No. Cancel.', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');

                        console.log('delete: ' + id);
                        TrackulaApp.actions.get(id).deleteRecord();
                    }, function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                        console.log('cancel: ' + id);
                    });
                }
            } else if (direction === 'right') {
                var left = $(self).find('.left');
                if (distance > parseInt(left.css('width'))) {
                    $('.ew-content').css('filter', 'blur(10px)');
                    $('.ew-content').css('-webkit-filter', 'blur(10px)');
                    Dialog.show('test', 'message', 'yes', 'no', function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
                    }, function() {
                        $('.ew-content').css('filter', '');
                        $('.ew-content').css('-webkit-filter', '');
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