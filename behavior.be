const VIEW_PASSWORD = 'yourpassword';
const CONTROL_PASSWORD = 'yourpassword';

behavior('/view', {
    open: function(event) {
        if (event.token != VIEW_PASSWORD) {
            event.deny('not_allowed');
        }
        event.channel.findall('users:*', function(err, items) {
            var msg = JSON.stringify({users_on_channel: items});
            event.allow(msg);
        });
        event.channel.set('users:' + event.connection.id, event.connection.id);
        event.channel.emit(JSON.stringify({type:'join', user: event.connection.id}));
        
    },
    close: function(event) {
        event.channel.del('users:' + event.connection.id);
        event.channel.emit(JSON.stringify({type:'left', user: event.connection.id}));
    }
});

behavior('/control', {
    open: function(event) {
        if (event.write) {
            if (event.token != CONTROL_PASSWORD) {
                event.deny('not_allowed');
            }
            event.allow();
        }
    }
});
