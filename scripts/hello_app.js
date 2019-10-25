var request = require('request');
 
request({
	url: 'https://test-api.service.hmrc.gov.uk/oauth/authorize',
	method: 'GET',
	qs: {
		'response_type': 'code',
		'client_id': 'AGGbRJn4ouD4X1IO1DqGq8nBiW4a',
		'scope': 'hello',
		'redirect_uri': 'https://www.transcraft.co.uk/mtd/code'
	}
}, function(err, res) {
	console.log('body='+res.body);
	var json = JSON.parse(res.body);
	console.log(json);
});
