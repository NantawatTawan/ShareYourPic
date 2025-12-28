// Data Transfer Objects for Images

export class ImageDTO {
  constructor(image) {
    this.id = image.id;
    this.tenantId = image.tenant_id;
    this.fileUrl = image.file_url;
    this.thumbnailUrl = image.thumbnail_url;
    this.caption = image.caption;
    this.status = image.status;
    this.likeCount = image.like_count || 0;
    this.commentCount = image.comment_count || 0;
    this.hasLiked = image.hasLiked || false;
    this.createdAt = image.created_at;
    this.approvedAt = image.approved_at;
  }

  static fromDatabase(image) {
    return new ImageDTO(image);
  }

  static fromDatabaseArray(images) {
    return images.map(img => new ImageDTO(img));
  }
}

export class GalleryImageDTO extends ImageDTO {
  constructor(image, hasLiked = false) {
    super(image);
    this.hasLiked = hasLiked;
  }
}

export class ImageDetailDTO extends ImageDTO {
  constructor(image, comments = [], hasLiked = false) {
    super(image);
    this.comments = comments.map(c => new CommentDTO(c));
    this.hasLiked = hasLiked;
  }
}

export class CommentDTO {
  constructor(comment) {
    this.id = comment.id;
    this.imageId = comment.image_id;
    this.sessionId = comment.session_id;
    this.commentText = comment.comment_text;
    this.createdAt = comment.created_at;
  }
}

export class LikeResponseDTO {
  constructor(imageId, liked, likeCount) {
    this.success = true;
    this.imageId = imageId;
    this.liked = liked;
    this.likeCount = likeCount;
    this.timestamp = new Date().toISOString();
  }
}

export class PaginatedResponseDTO {
  constructor(data, total, offset, limit) {
    this.success = true;
    this.data = data;
    this.pagination = {
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }
}
