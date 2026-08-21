const { execSync } = require('child_process');

try {
  console.log('=======================================================');
  console.log(' Committing and Pushing HTML Player to GitHub');
  console.log(' Repository: https://github.com/vimlesh1975/htmlplayer.git');
  console.log('=======================================================');

  const repoUrl = 'https://github.com/vimlesh1975/htmlplayer.git';

  try {
    console.log('Initializing Git LFS...');
    execSync('git lfs install', { stdio: 'inherit' });
  } catch (e) {
    console.log('Note: Ensure Git LFS is installed (https://git-lfs.github.com)');
  }

  execSync('git init', { stdio: 'inherit' });

  try {
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
  } catch (e) {
    execSync(`git remote set-url origin ${repoUrl}`, { stdio: 'inherit' });
  }

  console.log('Tracking LFS files globally...');
  execSync('git lfs track "*.dll"', { stdio: 'inherit' });
  execSync('git lfs track "*.exe"', { stdio: 'inherit' });
  execSync('git lfs track "*.pak"', { stdio: 'inherit' });
  execSync('git lfs track "*.dat"', { stdio: 'inherit' });
  execSync('git lfs track "*.lib"', { stdio: 'inherit' });

  console.log('Migrating any non-LFS commits to Git LFS pointer format...');
  try {
    execSync('git lfs migrate import --include="*.dll,*.exe,*.pak,*.dat,*.lib" --everything --yes', { stdio: 'inherit' });
  } catch (e) {
    // Continue if migrate import is not needed
  }

  console.log('Adding files...');
  execSync('git add .gitattributes', { stdio: 'inherit' });
  execSync('git add -A', { stdio: 'inherit' });

  console.log('Creating commit...');
  try {
    execSync('git commit -m "Integrate CeftoDecklink with 100% Pure HTML DOM playout and Hardware Key & Fill dual SDI output (including build/Release binaries)"', { stdio: 'inherit' });
  } catch (e) {
    console.log('Commit note:', e.message);
  }

  console.log('Setting branch main...');
  execSync('git branch -M main', { stdio: 'inherit' });

  console.log('Configuring Git HTTP buffer size...');
  execSync('git config http.postBuffer 1073741824', { stdio: 'inherit' });
  execSync('git config http.version HTTP/1.1', { stdio: 'inherit' });

  console.log('Pushing to remote origin main...');
  execSync('git push -u origin main --force', { stdio: 'inherit' });

  console.log('=======================================================');
  console.log(' Done! Successfully Pushed to GitHub!');
  console.log('=======================================================');
} catch (err) {
  console.error('Push script error:', err.message);
}
