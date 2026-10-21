import { Controller, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateProfile(@Request() req, @Body() body: any) {
    const userId = req.user.userId;

    return this.usersService.updateProfile(userId, body);
  }
}
