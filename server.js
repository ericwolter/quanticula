var static = require('node-static');

var file = new static.Server();

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        //
        // Serve files!
        //
        file.serve(request, response);
    }).resume();
}).listen(process.env.VCAP_APP_PORT || 3000);