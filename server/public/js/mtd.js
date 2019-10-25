function displayError(xhr, status, error) {
    var msg = xhr.responseText;
    if (!msg) {
        msg = error;
    }
    alert(status + ': ' + msg);
}
