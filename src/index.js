
var FakeServer = require('mysql/test/FakeServer.js')
var common = require('mysql/test/common')

var deasync = require('deasync')

var send_data_reply = (conn, fields, rows) => {
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
	setup: (connections, cb_ready, cb_query) => {

		for(var key in connections) {
			var server = new FakeServer()

			var done = false;
			var host_port = connections[key];
			var port = parseInt(host_port.split(":")[1]);

			(() => {
				var p = port
				var connection_name = key
				server.listen(p, function (err) {
					if(err) {
						throw err
					}
					console.error(`FakeServer ${connection_name} listening port ${p}`) // Not actually an error
					done = true
				})

				deasync.loopWhile(() => { return !done })

				server.on('connection', function(conn) {
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
						var reply = cb_query(conn, connection_name, packet.sql); 
						if (reply) {
							send_data_reply(conn, reply.fields, reply.rows)							
						} else {
							this._sendPacket(new common.Packets.ErrorPacket({
								errno   : common.Errors.ER_QUERY_INTERRUPTED,
								message : 'Interrupted unknown query'
							}));

							this._parser.resetPacketNumber();
						}
					});
				});
			})()
		}

		cb_ready()
	},
}

