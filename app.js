require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
app.use(express.static("public"));
app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SECRET,
  resave:false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());


//create and connect to the data
mongoose.connect("mongodb+srv://admin-somnath:Test123@cluster0.x24ma.mongodb.net/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex",true);

//global variables
let id = "";
let selectedGoal = "";
const uri = process.env.MONGODB_URI;



const goalSchema = new mongoose.Schema({
  goal:String,
  subGoals:[{
    subGoalNo:Number,
    subGoalName:{
      type:String,
      default:""
    },
    reached:{
      type:Boolean,
      default:false
    }
  }]
});

const userSchema = new mongoose.Schema({
  email:String,
  password:String,
  googleId:String,
  facebookId:String,
  goals:[goalSchema]
});



userSchema.plugin(findOrCreate);

const User = new mongoose.model("User",userSchema);
const Goal = new mongoose.model("Goal",goalSchema);

passport.serializeUser(function(user,done){
  done(null,user.id);
});
passport.deserializeUser(function(id,done){
  User.findById(id,function(err,user){
    done(err,user);
  });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://sleepy-anchorage-97310.herokuapp.com/auth/google/trackYourProgress",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    id = profile.id;
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://sleepy-anchorage-97310.herokuapp.com/auth/facebook/trackYourProgress"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    id = profile.id;
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

////////////////////////////ROUTES TO HOME PAGE//////////////////////////
app.get("/",function(req,res){
  res.render("home");
});

////////////////////////////ROUTES TO FACEBOOK///////////////////////////
app.get('/auth/facebook',
passport.authenticate('facebook'));

app.get('/auth/facebook/trackYourProgress',
passport.authenticate('facebook', { failureRedirect: '/login' }),
function(req, res) {
// Successful authentication, redirect home.
res.redirect('/dashboard');
});

////////////////////////////ROUTES TO GOOGLE/////////////////////////////
app.get('/auth/google',
  passport.authenticate('google', { scope: ["profile"] }));

app.get('/auth/google/trackYourProgress',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect secrets.
      res.redirect('/dashboard');
    });

////////////////////////////ROUTES TO REGISTER PAGE//////////////////////
app.get("/register",function(req,res){
  res.render("register");
});

////////////////////////////ROUTES TO LOGIN PAGE/////////////////////////
app.get("/login",function(req,res){
  res.render("login");
});

////////////////////////////ROUTES TO DASHBOARD PAGE/////////////////////
app.get("/dashboard",function(req,res){
const allGoals = [];
let subgoals = [];
const subGoalsReached = [];
  User.findOne({$or:[{facebookId:id},{googleId:id}]},function(err,foundDoc){

    if(foundDoc.goals.length>0){
      if(selectedGoal===""){
        selectedGoal = foundDoc.goals[0].goal;
      }
      foundDoc.goals.forEach(function(goal){
        allGoals.push(goal.goal);
        if(selectedGoal === goal.goal){
          subgoals = goal.subGoals;
          goal.subGoals.forEach(function(subGoal){
            subGoalsReached.push(subGoal.reached);
          });

        }
      });
    }else{
      const allGoals = [];
      let subgoals = [];
    }

    if(req.isAuthenticated()){
      //pass all goals to dashboard page
      // pass no of sub goals to dashboard page
      res.render("dashboard",{allGoals:allGoals,subGoals:subgoals,subGoalsReached:subGoalsReached});
    }else{
      res.redirect("/login");
    }
  });
});

app.post("/addGoalName",function(req,res){

  const subGoalName = req.body.subName;
  const subGoalNo = req.body.subGoalNo;

  User.findOne({$or:[{facebookId:id},{googleId:id}]},{'goals': {$elemMatch: {goal: selectedGoal}}}, function(err, foundGoal) {
    if (!err) {
      foundGoal.goals[0].subGoals[subGoalNo-1].subGoalName = subGoalName;
      foundGoal.save();
      res.redirect("/dashboard");
    }else{
      console.log(err);
    }
  });

});
////////////////////////////ROUTES TO AddGoal PAGE/////////////////////
app.get("/addGoal",function(req,res){
  res.render("addGoal");
});

app.post("/addGoal",function(req,res){
  const newGoal = req.body.newGoal;
  const noOfSubGoals = req.body.noOfSubGoals;
  let subGoals = [];

  for(var i=0;i<noOfSubGoals;i++){
    subGoals.push({subGoalNo:i+1})
  }

  const goal = new Goal({
    goal: newGoal,
    subGoals:subGoals
  });
  User.findOneAndUpdate({$or:[{facebookId:id},{googleId:id}]},{$push:{goals:goal}},function(err,foundUser){
    if(!err){
      selectedGoal = newGoal;
      res.redirect("/dashboard");
    }else{
      console.log(err);
    }
  })
});

////////////////////////////ROUTES TO Selected goal PAGE/////////////////
app.get("/dashboard/:goalName",function(req,res){
  const goalName = req.params.goalName;
  selectedGoal = goalName;
  res.redirect("/dashboard")
});

////////////////////////////ROUTES TO LOGOUT PAGE/////////////////////////////////////////
app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/");
});


app.post("/checkReached",function(req,res){
  const subGoalNumber = req.body.reachedButton;

  User.findOne({$or:[{facebookId:id},{googleId:id}]},{'goals': {$elemMatch: {goal: selectedGoal}}}, function(err, foundGoal) {
    if (!err) {
      if(foundGoal.goals[0].subGoals[subGoalNumber-1].reached === false){
        foundGoal.goals[0].subGoals[subGoalNumber-1].reached = true;
        foundGoal.save();

      }else{
        foundGoal.goals[0].subGoals[subGoalNumber-1].reached = false;
        foundGoal.save();

      }

      res.redirect("/dashboard");
    }else{
      console.log(err);
    }
  });

})


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port,function(){
  console.log("Server started successful.");
});
