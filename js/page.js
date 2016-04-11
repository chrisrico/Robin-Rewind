var filter = {channel: null, votes: true, spam: true, system: true};

$(function () {
	$('[name]').each(function () {
		$(this).addClass($(this).attr('name'));
	});

	var autoscroll = $('.autoscroll').is(':checked');
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

			if (autoscroll && $message.is(':visible')) {
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
		recent = [];
		timeline.setPosition(timeline.history[$(this).text()]);
		$('#messages').children(':not(.header)').remove();
	});

	timeline.start();

	$('.active').change(function () {
		if ($(this).is(':checked'))
			timeline.start();
		else
			timeline.pause();
	});

	$('.autoscroll').change(function () {
		autoscroll = $(this).is(':checked');
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

	$('.filter-votes').change(function () {
		filter.votes = $(this).is(':checked');
		if (filter.votes) {
			$('.message.vote').show();
		} else {
			$('.message.vote').hide();
		}
	});

	$('.filter-spam').change(function () {
		filter.spam = $(this).is(':checked');
		if (filter.spam) {
			$('.message.spam').show();
		} else {
			$('.message.spam').hide();
		}
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

	var isVote = message.message.match(/^voted to (GROW|STAY|ABANDON)$/);
	if (isVote)
		$message.addClass('vote');

	var isSystem = message.user == '[robin]';
	if (isSystem)
		$message.addClass('system')

	var isSpam = message.message.length > 120;
	if (isSpam)
		$message.addClass('spam');

	if (filter.channel && message.channel !== filter.channel)
		$message.hide();
	if (!filter.spam && isSpam)
		$message.hide();
	if (!filter.system && isSystem)
		$message.hide();
	if (!filter.votes && isVote)
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