import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import generateToken from "../utils/generateToken";
import { hash, verify } from "argon2";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { userSelect } from "../prisma/selects";




export const adminRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password, company, location, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new ForbiddenError(
        "User already registered! Please proceed to login."
      );

    const hashedPassword = await hash(password);
    const data = {
      email,
      password: hashedPassword,
      fullName,
      company,
      location,
      role: role || 'ADMIN'
    };
    await prisma.user.create({
      data,
    });
    sendSuccessResponse(
      res,
      "Admin account successfully created!",
      {},
      201
    );
  } catch (error) {
    next(error);
  }
};
export const userRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, fullName, password, jobTitle, company, location, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      throw new ForbiddenError(
        "User already registered! Please proceed to login."
      );

    const hashedPassword = await hash(password);
    const data = {
      email,
      password: hashedPassword,
      fullName,
      jobTitle,
      company,
      location,
      role: role || 'USER'
    };
    await prisma.user.create({
      data,
    });
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
    const user = await prisma.user.findUnique({where: { email } });
    if (!user) throw new NotFoundError("User not found");

    const validPassword = await verify(user.password || "$passwordless", password);
    if (!validPassword) throw new UnauthorizedError("Invalid credentials");

    const availableDocument = await prisma.document.findMany({
      where: { isPublic: true },
      orderBy: { uploadedAt: 'desc' }, 
      select: { id: true, title: true }
    });

    //  const mostRecentDocument = availableDocument.length > 0 ? availableDocument[0] : null;

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });
    if (!userData) throw new NotFoundError("User data not found");
    const token = generateToken ({email, id: user.id});
    sendSuccessResponse(res, "Login successful", { 
      token, 
      user:{
        ...userData, 
      role: user.role,
      // documentId: mostRecentDocument?.id || null,
      // documentTitle: mostRecentDocument?.title || null,
      documents: availableDocument.map(doc => ({
          id: doc.id,
          title: doc.title,
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}
