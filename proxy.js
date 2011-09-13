/*
 * Copyright (c) 2011 David Gwynne <loki@animata.net>
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

var http = require('http');
var url = require('url');
var net = require('net');

var clientConnections = 0;

var server = http.createServer(function (req, res) {
	console.log(req.connection.remoteAddress + " " +
	    req.method + " " + req.url);
	u = url.parse(req.url);

	if (typeof u.protocol === 'undefined') {
		res.writeHead(500, {"Content-Type": "text/plain"});
		res.end("500 Missing protocol");
		return;
	}

	if (u.protocol != 'http:') {
		res.writeHead(500, {"Content-Type": "text/plain"});
		res.end("500 Unsupported protocol");
		return;
	}

	options = {
		method: req.method,
		host: u.hostname,
		path: u.pathname,
		headers: req.headers
	};

	if (typeof u.port !== 'undefined')
		options.port = u.port;
	if (typeof u.search !== 'undefined')
		options.path += u.search;
	if (typeof u.hash !== 'undefined')
		options.path += u.hash;

	delete(options.headers['proxy-connection']);
	options.headers['Connection'] = 'keep-alive';

	function proxyError (e) {
		res.writeHead(500, {"Content-Type": "text/plain"});
		res.end("500 " + e.message + "\n");
	}

	preq = http.request(options, function (pres) {
		pres.headers['connection'] = (clientConnections > 8) ?
		    'close' : 'Keep-Alive';

		res.writeHead(pres.statusCode, pres.headers);
		pres.pipe(res);
	});
	preq.once('error', proxyError);
	req.pipe(preq);
});

server.on('upgrade', function (req, c, head) {
	console.log(req.connection.remoteAddress + " " +
	    req.method + " " + req.url);

	if (req.method != 'CONNECT') {
		c.end();
	}

	host_port = req.url.split(':', 2);

	s = new net.Socket();
	s.setNoDelay();

	s.on('error', sError = function (e) {
		console.log('error: ' + e);
		c.end();
	});

	s.connect(host_port[1], host_port[0], function() {
		s = this;
		c.removeListener('error', sError);
		c.write("HTTP/" + req.httpVersion +
		    " 200 Connection established\r\n\r\n");
		c.pipe(s);
		s.pipe(c);
	});
});

server.on('connection', function (c) {
	clientConnections++;

	c.on('close', function() {
		clientConnections--;
	});
});

server.listen(8080);
