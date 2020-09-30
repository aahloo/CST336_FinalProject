const mysql = require('mysql');

module.exports = { 

     /**
      * creates database connection
      * @returns db connection
      */
    createConnection: function(){
         var conn = mysql.createConnection({
        host: 'cst336db.space',
        user: 'cst336_dbUser030',
    password: 'qq0mon',
    database: 'cst336_db030'
    });
    return conn;

    },
    /*
    createConnection: function(){
         var conn = mysql.createConnection({
         host: 'us-cdbr-iron-east-05.cleardb.net',
         user: 'bc0ca7ea703d0d',
         password: 'c8af3bcc',
         database: 'heroku_35b42c01aef0b09'
         });
    return conn;
    },
    */
};