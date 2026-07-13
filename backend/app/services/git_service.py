import os
import shutil
import urllib.parse
from git import Repo
from app.config import settings
from concurrent.futures import ThreadPoolExecutor

class GitService:
    # Extensions we want to support parsing
    SUPPORTED_EXTENSIONS = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.go': 'Go',
        '.java': 'Java',
        '.cpp': 'C++',
        '.hpp': 'C++',
        '.h': 'C++',
        '.cc': 'C++',
        '.c': 'C',
        '.rs': 'Rust',
        '.cs': 'C#',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.sh': 'Shell',
        '.bat': 'Batch',
        '.json': 'JSON',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.md': 'Markdown',
        '.html': 'HTML',
        '.css': 'CSS'
    }
    
    @staticmethod
    def get_repo_slug(repo_url: str) -> str:
        """
        Converts a repository URL to a safe directory name (slug).
        Example: https://github.com/owner/repo-name -> owner_repo-name
        """
        parsed = urllib.parse.urlparse(repo_url)
        path = parsed.path.strip("/")
        if path.endswith(".git"):
            path = path[:-4]
        # Replace slashes with underscores
        return path.replace("/", "_")

    @classmethod
    def clone_repository(cls, repo_url: str) -> str:
        """
        Clones a public GitHub repository. Returns the local directory path.
        Uses a shallow + blobless clone for maximum speed:
          - depth=1       : only the latest commit, no history
          - filter=blob:none : skip downloading file blobs at clone time (fetched on-demand)
          - single-branch : only the default branch
          - no-tags       : skip tag refs
        """
        slug = cls.get_repo_slug(repo_url)
        target_dir = os.path.join(settings.REPOS_DIR, slug)
        
        # If it already exists, clear it first for a clean clone
        if os.path.exists(target_dir):
            cls.delete_repository(target_dir)
            
        os.makedirs(target_dir, exist_ok=True)
        
        # Fast blobless shallow clone
        Repo.clone_from(
            repo_url,
            target_dir,
            depth=1,
            filter="blob:none",
            no_tags=True,
            single_branch=True,
            multi_options=["--no-recurse-submodules"],
        )
        return target_dir

    @classmethod
    def delete_repository(cls, local_path: str) -> None:
        """
        Deletes the repository folder from disk.
        """
        if os.path.exists(local_path):
            # Handle read-only files that git checkout might create on Windows
            def onerror(func, path, exc_info):
                import stat
                if not os.access(path, os.W_OK):
                    os.chmod(path, stat.S_IWRITE)
                    func(path)
                else:
                    raise
            shutil.rmtree(local_path, onerror=onerror)

    @classmethod
    def get_repository_stats(cls, local_path: str):
        """
        Scans a repository to return overall size, file counts, and language breakdown.
        """
        total_size = 0
        total_files = 0
        indexed_files = 0
        languages_bytes = {}
        files_list = []
        
        # Directories to ignore
        ignore_dirs = {'.git', 'node_modules', 'venv', '.venv', '__pycache__', 'dist', 'build', 'out'}
        
        for root, dirs, files in os.walk(local_path):
            # Modify dirs in-place to avoid traversing ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.')]
            
            for file in files:
                file_path = os.path.join(root, file)
                # Skip broken symlinks or unreadable files
                if not os.path.exists(file_path) or os.path.islink(file_path):
                    continue
                
                try:
                    file_size = os.path.getsize(file_path)
                except OSError:
                    continue
                    
                total_size += file_size
                total_files += 1
                
                ext = os.path.splitext(file)[1].lower()
                rel_path = os.path.relpath(file_path, local_path).replace("\\", "/")
                
                if ext in cls.SUPPORTED_EXTENSIONS:
                    indexed_files += 1
                    lang = cls.SUPPORTED_EXTENSIONS[ext]
                    languages_bytes[lang] = languages_bytes.get(lang, 0) + file_size
                    
                    files_list.append({
                        "path": rel_path,
                        "language": lang,
                        "size": file_size
                    })
        
        # Calculate language percentages
        total_lang_bytes = sum(languages_bytes.values())
        languages_pct = {}
        if total_lang_bytes > 0:
            for lang, b in languages_bytes.items():
                languages_pct[lang] = round((b / total_lang_bytes) * 100, 1)
                
        return {
            "total_size": total_size,
            "total_files": total_files,
            "indexed_files": indexed_files,
            "languages": languages_pct,
            "files": files_list
        }
