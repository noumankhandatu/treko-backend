const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const UserModel = require("../../models/user-model.js");
const jwt = require("jsonwebtoken");
const { handleErrorResponse } = require("../../utils/ErrorHandler.js");
const { CREATED, BAD_REQUEST } = require("../../utils/Status.js");
const {
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_SECRET,
} = require("../../enums/index.js");
const {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} = require("../../utils/tokens.js");

// Register User
const RegisterUser = asyncHandler(async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!name || !password || !email || !confirmPassword) {
      return res.status(BAD_REQUEST).send({
        message: "Please enter name, password, email, and confirm password",
      });
    }
    // Validate the email format
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmailValid) {
      return res.status(BAD_REQUEST).send({ message: "Invalid email format" });
    }
    // Check if the password and confirm password match
    if (password !== confirmPassword) {
      return res
        .status(BAD_REQUEST)
        .send({ message: "Password and confirm password do not match" });
    }
    const isEmailExist = await UserModel.findOne({ email: email });

    if (isEmailExist) {
      return res.status(BAD_REQUEST).send({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { name, email, password: hashedPassword };
    const newUser = await UserModel.create(user);
    const sendUser = { name, email };
    try {
      if (newUser)
        return res.status(CREATED).send({
          message: "User has been created Successfully",
          user: sendUser,
        });
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  } catch (error) {
    return handleErrorResponse(res, error);
  }
});

// Login User
const LoginUser = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res
        .status(400)
        .send({ message: "Please provide email and password" });
    }

    // Find user by email
    const user = await UserModel.findOne({ email }).select("+password");

    // Check if user exists
    if (!user) {
      return res.status(400).send({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If password is invalid
    if (!isPasswordValid) {
      return res.status(400).send({ message: "Invalid email or password" });
    }

    // Password is valid, send token
    sendToken(user, 200, res);
  } catch (error) {
    // Handle any unexpected errors
    return handleErrorResponse(res, error);
  }
});
// update accesstoken
const UpdateAccessToken = asyncHandler(async (req, res) => {
  try {
    const refresh_token = req.headers["x-refresh-token"];
    if (!refresh_token) {
      return res
        .status(401)
        .json({ message: "Refresh token is missing from headers" });
    }

    const decoded = jwt.verify(refresh_token, REFRESH_TOKEN_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Could not refresh token" });
    }
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Could not refresh token" });
    }

    const accessToken = jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET, {
      expiresIn: "10m",
    });
    const refreshToken = jwt.sign({ id: user._id }, REFRESH_TOKEN_SECRET, {
      expiresIn: "45m",
    });

    req.user = user;
    res.cookie("accessToken", accessToken, accessTokenOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenOptions);

    return res.status(200).json({
      message: "Token refreshed successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    // Customize the error handling based on the specific errors you want to handle
    if (error.name === "TokenExpiredError") {
      return res
        .status(403)
        .json({ message: "Refresh token has expired. Please login again." });
    }
    console.log(error, "error");
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

const Test = (req, res) => {
  res.json({ message: "Access granted" });
};
module.exports = { RegisterUser, LoginUser, UpdateAccessToken, Test };
