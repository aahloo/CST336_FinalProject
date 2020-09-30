const faker = require("faker");
const express = require("express");
const app = express();
app.set('view engine', 'ejs');
app.set("views", "./views/");
app.use(express.static("public"));

const session = require("express-session");
const bcrypt = require("bcryptjs");

app.engine('html', require('ejs').renderFile);

const tools = require("./tools.js");

// setting the required parameters to use sessions. You won’t be able to use session variables without it. The value of “secret” can be changed for anything else
app.use(session ({
   secret: "top secret!",
   resave: true,
   saveUninitialized: true
}));

// express middleware code; need this line for Express to be able to parse the parameters sent in a form using the POST method
app.use(express.urlencoded( {extended: true} ));

/*
A Node middleware function receives three parameters, the request, the response, and the function that needs to be executed afterwards, 
denoted by “next”. There could be several middleware calls between the route and the anonymous function:

app.get("/", mw1, mw2,  mw3, function(req, res) {     
//code to be executed after the three middlewares 
});
*/
app.get("/admin", isAuthenticated, function(req, res) {
    res.render("admin");
});

function isAuthenticated(req, res, next) {
    if (!req.session.authenticated) {
        res.redirect('/');
    }
    else {
        next();
    }
}

// logout code logic
app.get("/logout", function(req, res) {
    req.session.destroy();
    res.redirect("/");
});

/**
 * checks the bcrypt value of the password submitted
 * @param {string} password
 * @return {boolean} true if password submitted is equal to
 * bcrypt-hashed value, false otherwise
 */
function checkPassword(password, hashedValue) {
    return new Promise( function(resolve, reject) {
        bcrypt.compare(password, hashedValue, function(err, result) {
            //console.log("Result: " + result);
            resolve(result);
        });
    });
}

/**
 * checks whether the username exists in database;
 * if found, returns corresponding record.
 * @param {string} username
 * @return {array of objects}
 */
function checkUsername(username) {
    let sql = "SELECT * FROM users WHERE username = ? ";    // retrieve the record based on the username submitted. It uses a placeholder to avoid SQL injection
    return new Promise( function(resolve, reject) {     // Promise object surrounding the asynchronous query function.
        let conn = tools.createConnection();    // creates the database connection by calling the function implemented before
        conn.connect(function(err) {    // connect to database
            if (err) throw err;
            conn.query(sql, [username], function(err, rows, fields) {   // executes the SQL statement, replacing the placeholder with the “username” passed to the function
                if (err) throw err;
                //console.log("Rows found: " + rows.length);
                resolve(rows);  // returns the result of the SQL statement, whether it is null (no records found) or the actual record
            });  // query
        });  // connect
    }); // Promise
}


//root route
app.get("/", async function(req, res) {
    res.render("index.html");
}); // root route


// other routes
app.get("/login", function(req, res) {
    res.render("login.ejs");
});

app.post("/login", async function(req, res) {
    //res.send("This is the root route using POST");
    let username = req.body.username;
    let password = req.body.password;
    //console.log("username: " + username);
    //console.log("password: " + password);
    
    //let hashedPswd = "$2a$10$RLykN23SREHnXiqqbBdTseWwLtqj7LrwAqJQewqhuh1hbNHIoXaVG";
    let result = await checkUsername(username);
    console.dir(result);    // used only for debugging
    let hashedPswd = "";    // initialize hash to blank
    
    // check whether the “result” array contains any items (this means that the username did exist in the database).
    // If so, it gets the hashed value of the password field and assign it to hashPswd
    if (result.length > 0) {
        hashedPswd = result[0].password;
    }
    
    let passwordMatch = await checkPassword(password, hashedPswd);
    //console.log("passwordMatch: " + passwordMatch);
    
    //if (username == 'admin' && password == 'secret') { // non-hashing password
    if (passwordMatch) {
        //res.send("Right Credentials!");
        req.session.authenticated = true;
        res.render("admin");
    }
    else {
        res.render("login", {"loginError": true});
    }
});

app.get("/valuations", function(req, res) {
    res.render("valuations.html");
});

app.get("/cart.html", function(req, res) {
    var conn = tools.createConnection();
    var sql = "SELECT cart.username, cart.sequence, cart.quantity_in_cart, inventory.model, " +
        "inventory.price, inventory_quantities.color_color_code AS color, inventory_quantities.gender, " +
        "inventory_quantities.size, inventory_quantities.quantity_on_hand, inventory_quantities.image_path, inventory.model_description, " +
        "CONCAT(inventory.model, inventory_quantities.color_color_code, inventory_quantities.gender, " +
        "inventory_quantities.size) AS sku FROM cart  INNER JOIN inventory ON " +
        "cart.inventory_quantities_inventory_model = inventory.model INNER JOIN inventory_quantities " +
        "ON cart.inventory_quantities_inventory_model = inventory_quantities.inventory_model " +
        "AND cart.inventory_quantities_size = inventory_quantities.size " +
        "AND cart.inventory_quantities_color_color_code = inventory_quantities.color_color_code " +
        "AND cart.inventory_quantities_gender = inventory_quantities.gender " +
        "WHERE cart.username = ? ORDER BY sequence";
    //var sqlParams = req.query.username;
    var sqlParams = "generic";

    conn.connect(function(err) {
        if (err) throw err;
        conn.on('error', function(err) {
                console.log(err.code); // 'ER_BAD_DB_ERROR'
                conn.end();
            });
        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            res.render("cart.html", { "itemsInCart": result });
            conn.end();
            
        });
    });
});


app.get("/signedUp.html", function(req, res) {
    res.render("signedUp.html");
});

//getting fake name and zip code data from faker API
app.get("/ordered", function(req, res) {
    res.render("ordered.html", { "name": faker.name.findName(), "zipCode": faker.address.zipCode() });
});

//queries to DB

//gets all from inventory
app.get("/db/displayInventory", async function(req, res) {
    var conn = tools.createConnection();
    var sql;
    var sqlParams;

    if (req.query.action == "loadProduct") {
        sql = "CALL getFilteredProductList (?,?,?,?);";
        sqlParams = [req.query.color, req.query.gender, req.query.styles, req.query.size];
        //console.log("Search Params:" + sqlParams);
    }
    sql = "CALL getFilteredProductList (?,?,?,?);";
    sqlParams = [req.query.color, req.query.gender, req.query.styles, req.query.size];

    conn.connect(function(err) {

        if (err) throw err;

        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.on('error', function(err) {
                console.log(err.code); // 'ER_BAD_DB_ERROR'
            });
            if (result == " ") {
                alert("empty result.");
                conn.end();
            }

            /*This block below is intended to clean up and modify the results from the database
            as a string and parse is accordingly. The counter limits the amount of results to be displayed,
            if omited in the split method, will return all results of that query.
            For multiple result, it is simply seperated by a ",". Could not quite parse nicely with
            JSON from the database therefore was stringified and adjusted.
            */
            var stringifiedResult = JSON.stringify(result);
            var splitResult = stringifiedResult.split(",RowDataPacket ");
            var replacedString = splitResult.toString().replace(/[^a-zA-Z0-9[]_:.{},\/"]/g, ' ').replace(/  +/g, ' ');
            //sets up data to be parsed and displayed on screen
            //console.log(replacedString);
            res.send(replacedString); //This is the correct method to use to pass information back
            conn.end();
        });

    });

}); //display Inventory


//gets all from inventory
app.get("/db/getValuation", async function(req, res) {
    var conn = tools.createConnection();
    var sql;
    var sqlParams;

    sql = "CALL getInventoryValuation(?);";
    sqlParams = [req.query.userInput];

    conn.connect(function(err) {

        if (err) throw err;

        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.on('error', function(err) {
                console.log(err.code); // 'ER_BAD_DB_ERROR'
            });
            if (result == " ") {
                alert("empty result.");
                conn.end();
            }

            /*This block below is intended to clean up and modify the results from the database
            as a string and parse is accordingly. The counter limits the amount of results to be displayed,
            if omited in the split method, will return all results of that query.
            For multiple result, it is simply seperated by a ",". Could not quite parse nicely with
            JSON from the database therefore was stringified and adjusted.
            */
            var stringifiedResult = JSON.stringify(result);
            var splitResult = stringifiedResult.split(",RowDataPacket ");
            var replacedString = splitResult.toString().replace(/[^a-zA-Z0-9[]_:.{},\/"]/g, ' ').replace(/  +/g, ' ');
            //sets up data to be parsed and displayed on screen
            //console.log(replacedString);
            res.send(replacedString); //This is the correct method to use to pass information back
            conn.end();
        });

    });

}); //display Inventory





//gets all from inventory
app.get("/db/insertIntoCart", async function(req, res) {
    var conn = tools.createConnection();
    var sql;
    var sqlParams;
    sql = "CALL transaction_add_cart_item (?,?,?,?,?,?);";
    sqlParams = [req.query.username, req.query.inventory_quantities_inventory_model,
        req.query.inventory_quantities_size, req.query.inventory_quantities_color_color_code,
        req.query.inventory_quantities_gender, req.query.quantity_in_cart
    ];

    conn.connect(function(err) {

        if (err) throw err;

        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.on('error', function(err) {
                console.log(err.code); // 'ER_BAD_DB_ERROR'
            });
            res.send(result);
            conn.end();
        });

    });

}); //Insert Inventory

app.get("/db/displayCart", async function(req, res) {
    var conn = tools.createConnection();
    var sql;
    var sqlParams;
    sql = "CALL getCartItems(?);";
    sqlParams = [req.query.username];

    conn.connect(function(err) {

        if (err) throw err;

        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.on('error', function(err) {
                console.log(err.code); // 'ER_BAD_DB_ERROR'
            });
            var stringifiedResult = JSON.stringify(result);
            var splitResult = stringifiedResult.split(",RowDataPacket ");
            var replacedString = splitResult.toString().replace(/[^a-zA-Z0-9[]_:.{},\/"]/g, ' ').replace(/  +/g, ' ');
            //sets up data to be parsed and displayed on screen
            res.send(replacedString); //This is the correct method to use to pass information back
            conn.end();
        });
    });

}); //display Inventory

//get user cart contents
app.get("/api/getInventoryForCartItems", function(req, res) {

    var conn = tools.createConnection();
    var sql = "SELECT cart.username, cart.sequence, cart.quantity_in_cart, " +
        "inventory_quantities.quantity_on_hand FROM cart " +
        "INNER JOIN inventory " +
        "ON cart.inventory_quantities_inventory_model = inventory.model " +
        "INNER JOIN inventory_quantities " +
        "ON cart.inventory_quantities_inventory_model = inventory_quantities.inventory_model " +
        "AND cart.inventory_quantities_size = inventory_quantities.size " +
        "AND cart.inventory_quantities_color_color_code = inventory_quantities.color_color_code " +
        "AND cart.inventory_quantities_gender = inventory_quantities.gender " +
        "WHERE cart.username = ? ORDER BY sequence";
    var sqlParams = req.query.username;

    conn.connect(function(err) {
        if (err) throw err;
        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            res.send(result);
            conn.end();

        });
    });
});

app.get("/api/updateCartQuantity", function(req, res) {
    var conn = tools.createConnection();
    var sql = "UPDATE cart " +
        "SET quantity_in_cart = ? " +
        "WHERE username = ? AND sequence = ?";
    //var sqlParams = req.query.username;
    var sqlParams = [req.query.newQuantity, req.query.username, req.query.sequence];

    conn.connect(function(err) {
        if (err) throw err;
        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.end();

        });
    });
});

app.get("/api/deleteFromCart", function(req, res) {

    var conn = tools.createConnection();
    var sql = "DELETE FROM cart " +
        "WHERE username = ? AND sequence = ?";
    //var sqlParams = req.query.username;
    var sqlParams = [req.query.username, req.query.sequence];

    conn.connect(function(err) {
        if (err) throw err;
        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.end();
        });
    });
});

var mysql = require('mysql');

/**
 * This middleware provides a consistent API 
 * for MySQL connections during request/response life cycle
 */ 
var myConnection  = require('express-myconnection')
/**
 * Store database credentials in a separate config.js file
 * Load the file/module and its values
 */ 
var config = require('./config')
var dbOptions = {
	host:	  config.database.host,
	user: 	  config.database.user,
	password: config.database.password,
	database: config.database.db
}

/**
 * 3 strategies can be used
 * single: Creates single database connection which is never closed.
 * pool: Creates pool of connections. Connection is auto release when response ends.
 * request: Creates new connection per new request. Connection is auto close when response ends.
 */ 
app.use(myConnection(mysql, dbOptions, 'pool'))

/**
 * setting up the templating view engine
 */ 
 
var index = require('./public/js/index')
var users = require('./public/js/users')


/**
 * Express Validator Middleware for Form Validation
 */ 
var expressValidator = require('express-validator')
app.use(expressValidator())


/**
 * body-parser module is used to read HTTP POST data
 * it's an express middleware that reads form's input 
 * and store it as javascript object
 */ 
var bodyParser = require('body-parser')
/**
 * bodyParser.urlencoded() parses the text as URL encoded data 
 * (which is how browsers tend to send form data from regular forms set to POST) 
 * and exposes the resulting object (containing the keys and values) on req.body.
 */ 
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())


/**
 * This module let us use HTTP verbs such as PUT or DELETE 
 * in places where they are not supported
 */ 
var methodOverride = require('method-override')

/**
 * using custom logic to override method
 * 
 * there are other ways of overriding as well
 * like using header & using query value
 */ 
app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method
    delete req.body._method
    return method
  }
}))

/**
 * This module shows flash messages
 * generally used to show success or error messages
 * 
 * Flash messages are stored in session
 * So, we also have to install and use 
 * cookie-parser & session modules
 */ 
const flash = require('express-flash')
const cookieParser = require('cookie-parser');
const admin_session = require('express-session');

app.use(cookieParser('keyboard cat'))
app.use(admin_session({ 
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true,
	cookie: { maxAge: 60000 }
}))
app.use(flash())


app.use('/admin', index)
app.use('/users', users)

app.get('/reports', function (req, res) {
  res.render('reports.html');
});


  app.get("/api/createOrder", function(req, res) {

    var conn = tools.createConnection();
    var sql = 'CALL transaction_checkout(?)';
    var sqlParams = req.query.username;

    conn.connect(function(err) {
        if (err) throw err;
        conn.query(sql, sqlParams, function(err, result) {
            if (err) throw err;
            conn.end();
        });
    });
});

app.listen(process.env.PORT, process.env.IP, function() {
    console.log("Running Express Server...");
});
