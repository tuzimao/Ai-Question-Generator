import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserRequest } from '../models/User';
import { db } from '../utils/database';

export class AuthService {
  async createUser(userData: CreateUserRequest): Promise<User> {
    const existingUser = await db('users').where('email', userData.email).first();
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const userId = uuidv4();

    const [user] = await db('users').insert({
      id: userId,
      email: userData.email,
      password_hash: hashedPassword,
      username: userData.username,
      display_name: userData.display_name,
      role: userData.role || 'teacher'
    }).returning('*');

    return user;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await db('users')
      .where('email', email)
      .where('is_active', true)
      .first();

    if (!user) return null;

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) return null;

    // 更新最后登录时间
    await db('users').where('id', user.id).update({
      last_login_at: new Date()
    });

    return user;
  }
    async getUserById(userId: string): Promise<User | null> {
        const user = await db('users').where('id', userId).first();
        return user || null;
    }
    async updateUser(userId: string, userData: Partial<CreateUserRequest>): Promise<User> {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // 只允许更新特定字段
        const allowedFields: (keyof CreateUserRequest)[] = ['username', 'display_name', 'bio', 'phone'];
        const updateData: Partial<CreateUserRequest> = {};

        for (const field of allowedFields) {
            if (userData[field] !== undefined) {
                updateData[field] = userData[field];
            }
        }

        if (userData.password) {
            updateData.password_hash = await bcrypt.hash(userData.password, 12);
        }

        const [updatedUser] = await db('users')
            .where('id', userId)
            .update(updateData)
            .returning('*');

        return updatedUser;
    }
}