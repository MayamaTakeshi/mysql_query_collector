const mysql   = require('mysql');
const mqc      = require('../src/index.js')

const HOST = "0.0.0.0"
const PORT = 12345

const QUERY = 'SELECT 1 + 1 AS solution'

servers = [{
	name: 'the_server',
	host: HOST,
	port: PORT,
	}
]

mqc.setup(servers, 
	() => {
		console.log("ready")
	},
	(conn, server, query) => {
		console.log(`The server ${server.name} received: ${query}`)
		if(query == QUERY) {
			mqc.send_reply(conn, {
				type: "dataset",
				fields: [
					{
						name: "solution",
					}
				],
				rows: [
					[ 2 ],
				]
			})
		} else {
			mqd.send_reply(conn, {
				type: 'error',
				errno: 11111,
				message: 'Unexpected query'
			})
		}
	},
	null
)

var connection = mysql.createConnection({
	host     : HOST,
	port     : PORT,
	user     : 'me',
	password : 'secret',
	database : 'my_db'
})

connection.connect()

connection.query(QUERY, function (error, results, fields) {
	if (error) throw error
	console.log(`The client received: ${JSON.stringify(results)}`)
	process.exit(0)
})

