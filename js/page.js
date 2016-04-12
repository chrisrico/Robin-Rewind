var filter = {channel: null, votes: false, spam: false, system: false};

$(function () {
	$('[name]').each(function () {
		$(this).addClass($(this).attr('name'));
	});

	var $messages = $('#messages')

	var recent = [];
	function calculateMessageRate() {
		var last = recent[recent.length - 1];
		recent = recent.filter(function (ts) {
			return last - ts < 10000;
		});
		var seconds = (last - recent[0]) / 1000;
		var rate = seconds > 0 ? recent.length / seconds : recent.length;
		$('.rate').text((Math.floor(rate * 10) / 10) + ' per second');
		timeout = setTimeout(calculateMessageRate, 500);
	}
	calculateMessageRate();

	var options = {
		steps: 500,
		onDelay: function (delay) {
			var m = pad(Math.floor(delay), -2);
			var s = pad(Math.round((delay - m) * 60), -2);
			var duration = m + ':' + s;
			$messages.append('<div class="message">Skipped ' + duration + ' of missing data</div>')
		},
		onMessage: function (message, index, rate) {
			recent.push(message.timestamp);

			var $activeChat = $('li.active:contains(' + $(this).text() + ')');
			if ($activeChat.text() != message.chat) {
				$activeChat.removeClass('active');
				$('li:contains(' + message.chat + ')').addClass('active');
			}

			$('.seek').val(index);
			$('.seek').prev().text(new Date(message.timestamp));
			$messages.children(':not(.header):lt(-500)').remove();

			var $message = createMessage(message, timeline.columns);
			$messages.append($message);

			if ($message.is(':visible')) {
				var parent = $message.parent()[0];
				parent.scrollTop = $message[0].offsetTop - parent.offsetTop;
			}
		}
	};

	var timeline = new Timeline(messages, options);

	var timestamps = timeline.checkpoints.map(function (position) {
		return messages[position].timestamp;
	});
	$('.seek').attr('max', timestamps.length - 1);

	createMessageHeaders(timeline.columns);
	fillChannelList(timeline.channels);
	createMarkers(timeline.history, function () {
		timeline.setPosition(timeline.history[$(this).text()]);
		recent = [];
		$('#messages').children(':not(.header)').remove();
	});

	timeline.start();

	$('.active').change(function () {
		if ($(this).is(':checked'))
			timeline.start();
		else
			timeline.pause();
	});

	$('.speed').on('input', function () {
		var speed = parseInt($(this).val());
		$(this).prev().text(speed + 'x');
		timeline.setSpeed(speed);
	});

	function adjustFont(amount) {
		$messages.css('font-size', (parseInt($messages.css('font-size')) + amount) + 'px');
	}

	$('.fontUp').click(function () {
		adjustFont(1);
	});

	$('.fontDown').click(function () {
		adjustFont(-1);
	});

	$('.filter-channel').change(function () {
		var channel = $(this).children(':selected').text();
		filter.channel = channel === '' ? null : channel;
		if (filter.channel) {
			var $channels = $('.message .channel:contains("' + channel + '")');
			$channels.parent().show();
			$('.message:not(.header) .channel').not($channels).parent().hide();
		} else {
			$('.message .channel').parent().show();
		}
	});

	['vote', 'system', 'spam'].forEach(function (tag) {
		$('.filter-' + tag).change(function () {
			filter[tag] = !$(this).is(':checked');
			if (filter[tag]) {
				$('.message.' + tag).hide();
			} else {
				$('.message.' + tag).show();
			}
		});
	});

	$('.seek').on('input', function () {
		recent = [];
		var time = new Date(timestamps[parseInt($(this).val())]);
		$(this).prev().text(time);
		timeline.setIndex(parseInt($(this).val()));
		$('#messages').children(':not(.header)').remove();
	});
});

function createMessageHeaders(columns) {
	var headerColumns = {
		Chat: columns.chat,
		Time: 8,
		Channel: columns.channel,
		User: -columns.user,
		Message: null
	}

	var $header = $('<div class="message header"></div>');
	for (var name in headerColumns) {
		var key = name.toLowerCase();
		var length = headerColumns[name];
		if (length)
			name = pad(name, length, ' ') ;
		$header.append($('<span class="' + key + '">' + name + '</span>'));
	}
	$('#messages').append($header);
}

function createMessage(message, columns) {
	var $message = $('<div class="message"></div>');

	['vote', 'system', 'spam'].forEach(function (tag) {
		if (message[tag]) {
			$message.addClass(tag);
			if (filter[tag])
				$message.hide();
		}
	});

	if (filter.channel && message.channel !== filter.channel)
		$message.hide();

	function addProperty(key, value) {
		$message.append($('<span class="' + key + '">' + value + '</span>'));
	}

	addProperty('chat', pad(message.chat, -columns.chat, ' '));
	addProperty('timestamp', formatTs(message.timestamp));
	addProperty('channel', pad(('channel' in message) ? message.channel : ''), -columns.channel, ' ');
	addProperty('user', pad(message.user, -columns.user, ' '));
	addProperty('message', message.message);

	return $message;
}

function fillChannelList(channels) {
	var sorted = Object.keys(channels).sort(function (a, b) {
		return channels[b] - channels[a];
	});

	var $list = $('.filter-channel');
	sorted.forEach(function (channel) {
		$list.append('<option>' + channel + '</option>');
	});
}

function createMarkers(history, click) {
	var sorted = Object.keys(history).sort(function (a, b) {
		return history[a] - history[b];
	});

	sorted.forEach(function (channel) {
		var $item = $('<a href="#">' + channel + '</a>')
		$item.click(click);
		$('ul.history').append($item);
		$item.wrap('<li></li>');
	});
}