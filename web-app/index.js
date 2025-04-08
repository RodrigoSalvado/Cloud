var express = require('express')

var app = express()
const port = process.env.PORT || 3000

app.use(express.static('app'))

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.listen(port, function () {
  console.log('Example app listening on port ${port}!');
});