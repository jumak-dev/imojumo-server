import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Post, ProConDiscussion, ProConVote, Comment } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { ProConVoteService } from '../pro-con-vote/pro-con-vote.service';
import { CreateProConDiscussionDto } from './dto/create-pro-con-discussion.dto';
import { UpdateProConDiscussionDto } from './dto/update-pro-con-discussion.dto';

@Injectable()
export class ProConDiscussionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ProConVoteService))
    private proConVoteService: ProConVoteService,
    private postService: PostsService,
  ) {}

  async convertPostToReposnse(
    post: Post & {
      ProConDiscussion: ProConDiscussion & {
        ProConVote: ProConVote[];
      };
      User: {
        username: string;
      };
      Comment: Comment[];
    },
  ) {
    const agreeCount = await this.proConVoteService.agreeCount(
      post.ProConDiscussion.id,
    );
    const disagreeCount = await this.proConVoteService.disagreeCount(
      post.ProConDiscussion.id,
    );
    const [firstAgree, firstDisagree] =
      await this.proConVoteService.findFirstVoteUsers(post.ProConDiscussion.id);

    return {
      id: post.id,
      author: post.User.username,
      title: post.title,
      content: post.content,
      views: post.views,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      agreeCount,
      disagreeCount,
      agreeUser: firstAgree?.User?.username || null,
      disagreeUser: firstDisagree?.User?.username || null,
      comments: post.Comment || [],
    };
  }

  async create(
    { title, content, isAgree }: CreateProConDiscussionDto,
    authorId: number,
  ) {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        title,
        content,
        ProConDiscussion: {
          create: {
            ProConVote: {
              create: {
                isAgree,
                userId: authorId,
              },
            },
          },
        },
      },
      include: {
        ProConDiscussion: {
          include: {
            ProConVote: true,
          },
        },
        User: {
          select: {
            username: true,
          },
        },
        Comment: true,
      },
    });

    console.log(post);

    return this.convertPostToReposnse(post);
  }

  //ToDo: 대표 두명, 찬반 카운트
  async findAll(limit: number, offset: number) {
    const posts = await this.prisma.post.findMany({
      where: {
        NOT: { ProConDiscussion: null },
      },
      take: limit,
      skip: offset,
      include: {
        ProConDiscussion: {
          select: {
            id: true,
          },
        },
        User: {
          select: {
            username: true,
          },
        },
      },
    });

    const totalCount = await this.prisma.proConDiscussion.count();
    const convertPostToReposnse = posts.map(async (post) => {
      const agreeCount = await this.proConVoteService.agreeCount(
        post.ProConDiscussion.id,
      );
      const disagreeCount = await this.proConVoteService.disagreeCount(
        post.ProConDiscussion.id,
      );
      const [firstAgree, firstDisagree] =
        await this.proConVoteService.findFirstVoteUsers(
          post.ProConDiscussion.id,
        );

      return {
        id: post.id,
        author: post.User.username,
        title: post.title,
        content: post.content,
        views: post.views,
        thumbup: post.thumbup,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        agreeCount,
        disagreeCount,
        agreeUser: firstAgree?.User?.username || null,
        disagreeUser: firstDisagree?.User?.username || null,
      };
    });

    return {
      posts: await Promise.all(convertPostToReposnse),
      totalCount,
    };
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findUnique({
      where: {
        id,
      },
      include: {
        ProConDiscussion: {
          include: {
            ProConVote: true,
          },
        },
        User: {
          select: {
            username: true,
          },
        },
        Comment: true,
      },
    });

    if (!post.ProConDiscussion) {
      throw new BadRequestException('찬성반대 토론 형태의 게시물이 아닙니다');
    }
    return this.convertPostToReposnse(post);
  }

  async findOneByPostId(postId: number) {
    return await this.prisma.proConDiscussion.findUnique({
      where: { postId },
    });
  }

  async findOneByPostIdThrow(postId: number) {
    const proConDiscussions = await this.prisma.proConDiscussion.findUnique({
      where: { postId },
    });

    if (!proConDiscussions) {
      throw new NotFoundException(
        `[${postId}] 게시글이 없거나 찬반토론이 아닙니다`,
      );
    }

    return proConDiscussions;
  }

  async update(
    id: number,
    { title, content, isAgree }: UpdateProConDiscussionDto,
    authorId: number,
  ) {
    console.log(title);
    if (isAgree !== undefined) {
      console.log(
        await this.proConVoteService.update({ isAgree }, authorId, id),
      );
    }

    const post = await this.prisma.post.update({
      where: {
        id,
      },
      data: {
        ...(title !== undefined && {
          title: title,
        }),
        ...(content !== undefined && {
          content: content,
        }),
      },
      include: {
        ProConDiscussion: {
          include: {
            ProConVote: true,
          },
        },
        User: {
          select: {
            username: true,
          },
        },
        Comment: true,
      },
    });

    return this.convertPostToReposnse(post);
  }

  remove(id: number) {
    return this.postService.remove(id);
  }
}
