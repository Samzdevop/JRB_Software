
import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import generateToken from "../utils/generateToken";
import { hash, verify } from "argon2";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { generateVerificationCode } from "../utils/generateVerificationCode";
import { BadRequestError } from "../errors/BadRequestError";
import { MailInterface } from "../interfaces/mail.interfaces";
import { sendCustomMail } from "../services/mail.services";
import { ForbiddenError } from "../errors/ForbiddenError";
import { render } from "../utils/mailTemplate";
import { compareDates } from "../utils/dateExpiration";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new ForbiddenError(
        "User already registered! Please proceed to login."
      );

    const hashedPassword = await hash(password);
    const verificationCode = generateVerificationCode().toString();
    const data = {
      email,
      password: hashedPassword,
      fullName,
      verificationCode,
      verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
    };
    await prisma.user.create({
      data,
    });
    const html = render("verification", {
      fullName,
      verificationCode,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Agritech" samzdevop@yahoo.com`,
      subject: "Verify your Agritech Account",
      text: "",
      html,
    };

    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);


    sendSuccessResponse(
      res,
      "Account successfully created, kindly verify your account!",
      {},
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    const isPasswordValid = await verify(
      user.password || "$passwordless",
      password
    );
    if (!isPasswordValid) throw new UnauthorizedError("Invalid credentials");

    if (!user.isVerified) throw new UnauthorizedError("Account not verified!");
    if (user.isSuspended)
      throw new UnauthorizedError(
        "Account suspended! Kindly reachout to support@lenzr.com"
      );

    const token = generateToken({ email, id: user.id });
    sendSuccessResponse(res, "Login successful", { token, user });
  } catch (error) {
    next(error);
  }
};

export const requestVerificationCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    const verificationCode = generateVerificationCode().toString();

    await prisma.user.update({
      where: { email },
      data: {
        verificationCode,
        verificationExpires: new Date(new Date().getTime() + 30 * 60 * 1000),
      },
    });
    const html = render("resend", {
      verificationCode,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Lenzr" olamide14044@yahoo.com`,
      subject: "Reset your Lenzr Password",
      text: "",
      html,
    };
    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);

    sendSuccessResponse(res, "Verification code successfully sent");
  } catch (error) {
    next(error);
  }
};

export const verifyAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, verificationCode } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    if (verificationCode !== user.verificationCode)
      throw new UnauthorizedError("Invalid or expired verification code");

    if (
      compareDates(user.verificationExpires || new Date(), new Date(), "before")
    )
      throw new UnauthorizedError("Invalid or expired verification code");

    await prisma.user.update({
      where: { email },
      data: { isVerified: true, verificationCode: "0" },
    });

    const html = render("welcome", {
      fullName: user.fullName,
      verificationCode,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Lenzr" olamide14044@yahoo.com`,
      subject: "Welcome to Lenzr",
      text: "",
      html,
    };
    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);
    sendSuccessResponse(res, "Account verification successful");
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, password, confirmPassword, verificationCode } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError("User not found");

    if (password !== confirmPassword)
      throw new BadRequestError(`Password don't match`);

    if (verificationCode !== user.verificationCode)
      throw new UnauthorizedError("Invalid or expired verification code");

    if (
      compareDates(user.verificationExpires || new Date(), new Date(), "before")
    )
      throw new UnauthorizedError("Invalid or expired verification code");

    const hashedPassword = await hash(password);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, verificationCode: "0" },
    });

    const html = render("reset", {
      fullName: user.fullName,
      currentYear: new Date().getFullYear(),
    });
    const mailOptions: MailInterface = {
      to: email,
      from: `"Lenzr" olamide14044@yahoo.com`,
      subject: "Lenzr Password Reset Successful",
      text: "",
      html,
    };
    if (process.env.NODE_ENV !== "test") sendCustomMail(mailOptions);
    sendSuccessResponse(res, "Password reset successful");
  } catch (error) {
    next(error);
  }
};
