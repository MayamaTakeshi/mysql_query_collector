
var FakeServer = require('mysql/test/FakeServer.js')
var common = require('mysql/test/common')

var deasync = require('deasync')

var send_error = (conn, errno, message) => {
	conn._sendPacket(new common.Packets.ErrorPacket({
		errno   : errno,
		message : message
	}));

	conn._parser.resetPacketNumber();
}

var send_ok = (conn) => {
		conn._sendPacket(new common.Packets.OkPacket());
		conn._parser.resetPacketNumber();
}

var send_dataset = (conn, fields, rows) => {
		conn._sendPacket(new common.Packets.ResultSetHeaderPacket({
			fieldCount: fields.length
		}));

		fields.forEach((field) => {
			conn._sendPacket(new common.Packets.FieldPacket({
				catalog    : 'def',
				charsetNr  : common.Charsets.UTF8_GENERAL_CI,
				name       : field.name,
				protocol41 : true,
				type       : field.type ? field.type : common.Types.VARCHAR
			}));
		})

		conn._sendPacket(new common.Packets.EofPacket());

		rows.forEach((row) => {
			var writer = new common.PacketWriter();
			row.forEach((value) => {
				writer.writeLengthCodedString(value);
			})
			conn._socket.write(writer.toBuffer(conn._parser));
		})

		conn._sendPacket(new common.Packets.EofPacket());
		conn._parser.resetPacketNumber();
}

module.exports = {
	setup: (servers, cb_ready, cb_query) => {

		servers.forEach((server) =>  {
			var s = new FakeServer()

			var done = false;
			var host_port = server.address;
			var port = parseInt(host_port.split(":")[1]);

			(() => {
				var p = port
				var server_name = server.name 
				s.listen(p, function (err) {
					if(err) {
						throw err
					}
					console.error(`FakeServer ${server_name} listening port ${p}`) // Not actually an error
					done = true
				})

				deasync.loopWhile(() => { return !done })

				s.on('connection', function(conn) {
					conn.handshake({
						protocolVersion: 10,
						serverVersion: "some_version",
						threadId: 100,
						serverCapabilities1: 0xf7ff,
						serverLanguage: 8,
						serverStatus: 2,
						protocol41: true,
					});

					conn.on('query', function(packet) {
						var reply = cb_query(conn, server_name, packet.sql); 
						if (reply) {
							switch(reply.type) {
							case "dataset":
								send_dataset(conn, reply.fields, reply.rows)							
								break
							case "ok":
								send_ok(conn)
								break
							case "error":
								send_error(conn, reply.errno, reply.message)
								break
							default:
								throw `Unsupported reply.type ${reply_type}`
							}
						} else {
							send_error(conn, common.Errors.ER_QUERY_INTERRUPTED, 'Interrupted unknown query')
						}
					});
				});
			})()
		})

		cb_ready()
	},
}

