import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import UserRequest from '../auth/types/user-request.interface';

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiBearerAuth()
  @Get()
  findAll(@Req() request: UserRequest) {
    return this.notificationService.getNotificationsForUser(request.user.id);
  }

  @ApiBearerAuth()
  @Patch(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    return await this.notificationService.markAsRead(id);
  }
}