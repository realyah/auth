const mongoose = require('mongoose');

const aboutMeSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    ref: 'User'
  },
  name: { type: String, required: true, trim: true },
  birthday: { type: String, trim: true },
  status: { type: String, trim: true },
  from: { type: String, trim: true },
  title: { type: String, trim: true },
  favoriteColor: { type: String, trim: true },
  favoriteSong: { type: String, trim: true },
  favoriteMovie: { type: String, trim: true },
  favoriteFood: { type: String, trim: true },
  myHobbies: { type: String, trim: true },
  wordsThatDescribeMe: { type: String, trim: true },
  myDreams: { type: String, trim: true },
  thingsILove: { type: String, trim: true },
  funFactsAboutMe: { type: String, trim: true },
  myMoto: { type: String, trim: true }
}, {
  timestamps: true
});

const AboutMe = mongoose.model('AboutMe', aboutMeSchema);

module.exports = AboutMe;
