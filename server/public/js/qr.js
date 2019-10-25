$(document).ready(function() {
    $('.qrPanel').hide();
    if (document.getElementById('username')) {
        $('#username').change(generateQR);
    }
    if (document.getElementById('secret')) {
        $('#secret').change(generateQR);
    }
});
$(document).on('click', '.qrGenerate', function(e) {
    e.preventDefault();
    generateQR();
});
function generateQR() {
    $('.qrPanel').show();
    var data = {
        secret: $('#secret').val()
    };
    if (document.getElementById('username')) {
        var user = $('#username').val();
        if (!user) {
            $('.qrPanel').hide();
            return;
        }
        data.username = user;
    }
    $.ajax({
        type: 'POST',
        url: 'createQR',
        data: data,
        success: function (data) {
            $("#qrImage").attr('src', data.qr);
            $('#qrUrl').html(data.url);
        },
        error: displayError
    });
}