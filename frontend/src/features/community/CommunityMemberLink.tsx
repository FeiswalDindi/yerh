import { Link } from 'react-router-dom';
import { displayRoleLabel } from '../../domain/roles';

export function CommunityMemberLink({
  userId,
  name,
  role,
  showRoleBadge = false,
  className = '',
}: {
  userId: number;
  name: string;
  role?: string;
  showRoleBadge?: boolean;
  className?: string;
}) {
  return (
    <span className={`community-member-inline${className ? ` ${className}` : ''}`}>
      <Link className="community-member-link" to={`/members/${userId}`}>
        {name}
      </Link>
      {showRoleBadge && role && <span className="users-badge">{displayRoleLabel(role)}</span>}
    </span>
  );
}
