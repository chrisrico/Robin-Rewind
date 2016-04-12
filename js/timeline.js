function pad(input, length, char='0') {
	if (typeof(input) !== 'string')
		input = input.toString();
	var direction = Math.sign(length);
	length = Math.abs(length);
	while (input.length < length) {
		if (direction === 1)
			input = input + char;
		else
			input = char + input;
	}
	return input;
}

function formatTs(timestamp) {
	var ts = new Date(timestamp);
	return [pad(ts.getHours(), -2), pad(ts.getMinutes(), -2), pad(ts.getSeconds(), -2)].join(':');
}

var channelRe = /\s*([:%#][\w]+|[#%`*~?$@^.&!:_+]{1,3}|<3|<>|!nl|;20qs|\(=\))/;
function fixChannel(message) {
	if (!message.channel)
		return;

	var match = message.channel.match(channelRe);
	if (match) {
		message.message = message.channel.replace(match[1], '') + message.message;
		message.channel = match[1];
	} else {
		message.message = message.channel + ' ' + message.message;
		delete message.channel;
	}
}

function Timeline(messages, options) {
	var speed = options.speed || 1;
	var steps = options.steps || 100;
	var onDelay = options.onDelay;
	var onMessage = options.onMessage;

	var timeout,
		active = false,
		index = 0,
		position = 0,
		history = {},
		checkpoints = [0],
		channels = {},
		columns = {chat: 0, channel: 0, user: 0};

	this.history = history;
	this.checkpoints = checkpoints;
	this.channels = channels;
	this.columns = columns;

	var spamDetector = {};

	var elapsed = messages[messages.length - 1].timestamp - messages[0].timestamp;
	for (var i = 0, message; message = messages[i]; i++) {
		var previous = messages[i - 1];
		if (!previous || previous.chat !== message.chat) {
			history[message.chat] = i + 1;
		}

		var checkpoint = messages[checkpoints[checkpoints.length - 1]];
		if (message.timestamp > checkpoint.timestamp + (elapsed / steps)) {
			checkpoints.push(i);
		}

		fixChannel(message);
		if (message.channel)
			if (message.channel in channels)
				channels[message.channel] += 1;
			else
				channels[message.channel] = 1;

		for (var key in columns) {
			if (key in message && message[key].length > columns[key])
				columns[key] = message[key].length;
		}

		if (message.user == '[robin]')
			message.system = true;

		if (message.message.match(/^voted to (GROW|STAY|ABANDON)$/))
			message.vote = true;

		if (message.message.match(/[^\u0000-\u00ff]/))
			message.spam = true;

		if (message.system || message.vote || message.spam)
			continue;

		if (!spamDetector.hasOwnProperty(message.message))
			spamDetector[message.message] = [];
		spamDetector[message.message].push(i);
	}

	for (var message in spamDetector) {
		var indexes = spamDetector[message];
		if (indexes.length > 5) {
			indexes.forEach(function (i) {
				messages[i].spam = true;
			});
		}
	}

	this.setIndex = function (_index) {
		index = _index;
		position = checkpoints[index];
		schedule();
	};

	function findCheckpoint() {
		for (var i = 1, checkpoint; checkpoint = checkpoints[i]; i++) {
			if (checkpoint > position)
				return i - 1;
		}
	}

	this.setPosition = function (_position) {
		position = _position;
		index = position === 0 ? 0 : findCheckpoint(position);
		schedule();
	};

	this.setSpeed = function (_speed) {
		speed = _speed;
		schedule();
	};

	this.start = function () {
		active = true;
		schedule();
	};

	this.pause = function () {
		active = false;
		schedule();
	};

	function schedule() {
		if (timeout)
			clearTimeout(timeout);

		if (!active)
			return;

		if (position === 0) {
			timeout = setTimeout(next);
		} else if (position < messages.length) {
			var delay = messages[position].timestamp - messages[position - 1].timestamp;
			if (delay > 15000) {
				setTimeout(onDelay.bind(null, delay / 1000 / 60));
				delay = 1000 * speed;
			}
			timeout = setTimeout(next, delay / speed);
		}
	}

	function next() {
		var message = messages[position++];
		if (!message)
			return;

		if (message.timestamp > messages[checkpoints[index]].timestamp) {
			index++;
		}

		setTimeout(function () {
			onMessage(message, index);
		});
		schedule();
	};
}