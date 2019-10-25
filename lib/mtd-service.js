const config = require("./mtd-config");
const util = require('./mtd-util');

const simpleOauthModule = require('simple-oauth2');

const MTD_HOSTS = {
    Test: 'https://test-api.service.hmrc.gov.uk',
    Live: 'https://api.service.hmrc.gov.uk'
};

const TAXONOMY = {
    vrn: 'VAT Registration Number',
    saUtr: 'Self Assessment Unique Tax Reference (UTR)',
    nino: 'National Insurance number',
    mtdItId: 'Making Tax Digital Income Tax ID',
    eoriNumber: 'Economic Operator Registration and Identification (EORI) number',
    mtdVrn: 'MTD VAT Reference Number',
    empRef: 'Employer Reference',
    ctUtr: 'Corporation Tax UTR',
    lisaManagerReferenceNumber: 'LISA Manager Reference Number',
    secureElectronicTransferReferenceNumber: 'Secure Electronic Transfer reference number',
    pensionSchemeAdministratorIdentifier: 'Pension Scheme Administrator Identifier',
    vatDueSales: 'VAT due on sales and other outputs',
    vatDueAcquisitions: 'VAT due on acquisitions from other EC Member States',
    totalVatDue: 'Total VAT due',
    vatReclaimedCurrPeriod: 'VAT reclaimed on purchases and other inputs (including acquisitions from the EC)',
    netVatDue: 'Net VAT due',
    totalValueSalesExVAT: 'Total value of sales and all other outputs excluding any VAT',
    totalValuePurchasesExVAT: 'Total value of purchases and all other inputs excluding any VAT (including exempt purchases)',
    totalValueGoodsSuppliedExVAT: 'Total value of all supplies of goods and related costs, excluding any VAT, to other EC member states',
    totalAcquisitionsExVAT: 'Total value of acquisitions of goods and related costs excluding any VAT, from other EC member states',
    finalised: 'Finalised',
    err: 'Error'
};

util.taxonomy(TAXONOMY);

module.exports = {
    myMenu: getMyMenu,
    myMenuItems: getMyMenuItems,
    myService: getMyService,
    allScopes: getAllScopes,
    oauth2: makeOauth2,
    fullUrl: getServiceFullUrl,
    allServices: getAllServices
};

function getMyMenu() {
    return SUPPORTED_CALLS
        .filter(item => envFilter(item))
        .map(item => ({ name: item.name, label: item.label }));
}

function getMyMenuItems(menu) {
    return SUPPORTED_CALLS.filter((item) => item.name == menu)[0]
        .services
        .filter(s => envFilter(s))
        .map(s => ({ name: s.name, label: s.label }));
}

function getMyService(serviceName) {
    return SUPPORTED_CALLS.map(m => m.services)
        .reduce((pre,cur) =>  pre.concat(cur))
        .filter(s => s.name === serviceName)[0];
}

function getAllScopes() {
    return SUPPORTED_CALLS
        .map(s => s.scope)
        .reduce((a,b) => a.concat('+').concat(b));
}

function getAllServices() {
    return SUPPORTED_CALLS
        .reduce((h, obj) => h[obj.name] = obj, {});
}

function makeOauth2(oauthConfig) {
    return simpleOauthModule.create({
        client: {
            id: oauthConfig.clientId,
            secret: oauthConfig.clientSecret,
        },
        auth: {
            tokenHost: MTD_HOSTS[oauthConfig.host],
            tokenPath: '/oauth/token',
            authorizePath: '/oauth/authorize',
        },
    });
}

function getServiceFullUrl(host, service, req, appConfig) {
    var url = util.buildUrl( service.url, {
        service: service,
        appConfig: appConfig,
        req: req
    });
    return MTD_HOSTS[host] + url;
}

function envFilter(item) {
    if (item.env) {
        if (Array.isArray(item.env)) {
            return item.env.includes(config.env);
        } else {
            return item.env === config.env;
        }
    } else {
        return true;
    }
}

const SUPPORTED_CALLS = [
    {
        name: 'hello',
        label: 'Hello',
        scope: 'hello',
        env: 'test',
        services: [
            {
                name: 'helloWorld',
                label: 'Say hello world',
                url: '/hello/world',
                method: 'GET',
                access: 'world'
            },
            {
                name: 'helloApp',
                label: 'Say hello application',
                url: '/hello/application',
                method: 'GET',
                access: 'app'
            },
            {
                name: 'helloUser',
                label: 'Say hello user',
                url: '/hello/user',
                method: 'GET',
                access: 'user'
            }
        ]
    },
    {
        name: 'createTestUser',
        label: 'Create Test User',
        env: 'test',
        services: [
            {
                name: 'createIndividualTestUser',
                label: 'Create Individual Test User',
                url: '/create-test-user/individuals',
                method: 'POST',
                access: 'app',
                request: {
                    "serviceNames": [
                        "national-insurance",
                        "self-assessment",
                        "mtd-income-tax",
                        "customs-services"
                    ]
                }
            },
            {
                name: 'createOrgTestUser',
                label: 'Create Organisation Test User',
                url: '/create-test-user/organisations',
                method: 'POST',
                access: 'app',
                request: {
                    "serviceNames": [
                        "corporation-tax",
                        "paye-for-employers",
                        "submit-vat-returns",
                        "national-insurance",
                        "self-assessment",
                        "mtd-income-tax",
                        "mtd-vat",
                        "lisa",
                        "secure-electronic-transfer",
                        "relief-at-source",
                        "customs-services"
                    ]
                }
            },
            {
                name: 'createAgentTestUser',
                label: 'Create Agent Test User',
                url: '/create-test-user/agents',
                method: 'POST',
                access: 'app',
                request: {
                    "serviceNames": [
                        "agent-services"
                    ]
                }
            }
        ]
    },
    {
        name: 'vat',
        label: 'VAT',
        scope: 'read:vat+write:vat+mtd-vat',
        services: [
            {
                name: 'retrieveVatObligations',
                label: 'Retrieve VAT Obligations',
                url: '/organisations/vat/{appConfig.vrn}/obligations',
                method: 'GET',
                access: 'user',
                request: {
                    from: 'date',
                    to: 'date'
                },
                response: {
                    periodKey: (row,k) => {
                        var v = ' <a href="submitVatReturn?periodKey='+row.periodKey+'">Submit Return'+'</a>' +
                            ' <a href="viewVatReturn?periodKey='+row.periodKey+'">View Return'+'</a>';
                        console.log(k+ '=>' +v);
                        return v;
                    }
                }
            },
            {
                name: 'viewVatReturn',
                label: 'View VAT Return',
                url: '/organisations/vat/{appConfig.vrn}/returns/{req.query.periodKey}',
                method: 'GET',
                access: 'user',
                request: {
                    periodKey: 'text'
                }
            },
            {
                name: 'submitVatReturn',
                label: 'Submit VAT return for period',
                url: '/organisations/vat/{appConfig.vrn}/returns',
                method: 'POST',
                access: 'user',
                request: {
                    "periodKey": "-req.query.periodKey-",
                    "totalValueSalesExVAT": 'number',
                    "totalValuePurchasesExVAT": 'number',
                    "totalValueGoodsSuppliedExVAT": 'number',
                    "totalAcquisitionsExVAT": 'number',
                    "vatDueSales": 'number',
                    "vatDueAcquisitions": 'number',
                    "totalVatDue": 'number',
                    "vatReclaimedCurrPeriod": 'number',
                    "netVatDue": 'number',
                    "finalised": 'boolean'
                },
                onsubmit: 'return confirm("When you submit this VAT information you are making a legal ' +
                    'declaration that the information is true and complete.\\nA false declaration ' +
                    'can result in prosecution.")'
            },
            {
                name: 'retrieveVatLiabilities',
                label: 'Retrieve VAT liabilities',
                url: '/organisations/vat/{appConfig.vrn}/liabilities',
                method: 'GET',
                access: 'user',
                request: {
                    from: 'date',
                    to: 'date'
                }
            },
            {
                name: 'retrieveVatPayments',
                label: 'Retrieve VAT payments',
                url: '/organisations/vat/{appConfig.vrn}/payments',
                method: 'GET',
                access: 'user',
                request: {
                    from: 'date',
                    to: 'date'
                }
            }
        ]
    }
];