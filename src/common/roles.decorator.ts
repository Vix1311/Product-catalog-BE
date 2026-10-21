import { SetMetadata } from '@nestjs/common';

// Hàm này giúp chúng ta gắn nhãn quyền (role) cho từng API
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);