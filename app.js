require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const FacebookStrategy = require('passport-facebook').Strategy;

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({
  extended: true
}));

app.use(express.static("public"));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGOURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.set("useCreateIndex", true);

const postSchema = {
  title: String,
  content: String,
};

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
});

// userSchema.plugin(encrypt, {secret:process.env.SECRET, encryptedFields:["password"]});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Post = mongoose.model("Post", postSchema);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

// GoogleStrategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://daily-journals-v.herokuapp.com/auth/google/all_posts",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  },
  function (accessToken, refreshToken, profile, done) {
    User.findOrCreate({
      googleId: profile.id
    }, function (err, user) {
      return done(err, user);
    });
  }
));

// FacebookStrategy
passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "https://daily-journals-v.herokuapp.com/auth/facebook/all_posts"
  },
  function (accessToken, refreshToken, profile, done) {
    User.findOrCreate({
      facebookId: profile.id
    }, function (err, user) {
      if (err) {
        return done(err);
      }
      done(null, user);
    });
  }
));

app.get("/", function (req, res) {
  res.render("home");
});

// GOOGLE AUTHENTICATION ROUTE
app.get("/auth/google",
  passport.authenticate('google', {
    scope: ["profile"]
  })
);

// GOOGLE AUTHENTICATION ROUTE for Login
app.get("/auth/google/all_posts",
  passport.authenticate('google', {
    failureRedirect: "/login"
  }),
  function (req, res) {
    // Successful authentication, redirect to all_posts route.
    res.redirect("/all_posts");
  });

// FACEBOOK AUTHENTICATION ROUTE
app.get('/auth/facebook',
  passport.authenticate('facebook')
);

// FACEBOOK AUTHENTICATION ROUTE for Login
app.get("/auth/facebook/all_posts",
  passport.authenticate("facebook", {
    failureRedirect: "/login"
  }),
  function (req, res) {
    // Successful authentication, redirect all_posts.
    res.redirect("/all_posts");
  });

// Normal Routing
app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.post("/register", function (req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        Post.find({}, function (err, posts) {
          res.render("all_posts", {
            posts: posts
          });
        });
      });
    }
  });
});


app.post("/login", function (req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function () {
        Post.find({}, function (err, posts) {
          res.render("all_posts", {
            posts: posts
          });
        });
      });
    }
  });
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/all_posts", function (req, res) {
  if (req.isAuthenticated()) {
    Post.find({}, function (err, posts) {
      res.render("all_posts", {
        posts: posts
      });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/all_posts/:postId/", function (req, res) {
  const requestedPostId = req.params.postId;

  Post.findOne({
    _id: requestedPostId
  }, function (err, post) {
    res.render("post", {
      title: post.title,
      content: post.content,
    });
  });
});

app.get("/about", function (req, res) {
  res.render("about");
});

app.get("/Testimonial", function (req, res) {
  res.render("testimonial")
});

app.get("/contact", function (req, res) {
  res.render("contact");
});

app.get("/compose", function (req, res) {
  res.render("compose");
});

app.post("/compose", function (req, res) {
  const post = new Post({
    title: req.body.newTitleText,
    content: req.body.newPostText,
  });

  post.save(function (err) {
    if (!err) {
      res.redirect("/all_posts");
    }
  });
});

// app.post("/delete", function (req, res) {
//   const clickedPostId = req.body.deleteBtn;

//   Post.findByIdAndDelete(clickedPostId, function (err) {
//     if (!err) {
//       console.log("Hata diya vr0");
//       res.redirect("/all_posts");
//     }
//   });
// });

app.get("/search", function (req, res) {
  const searchField = req.query.dsearch;
  Post.find({
      title: {
        $regex: searchField,
        $options: "$i"
      }
    },
    function (err, foundPosts) {
      if (!err) {
        res.render("all_posts", {
          posts: foundPosts
        });
      }
    }
  );
});

app.listen(PORT, function () {
  console.log("Server started on port 4000");
});
