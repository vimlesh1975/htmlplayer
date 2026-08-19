const { execSync } = require('child_process');

try {
  console.log('=======================================================');
  console.log(' Committing and Pushing HTML Player to GitHub');
  console.log(' Repository: https://github.com/vimlesh1975/htmlplayer.git');
  console.log('=======================================================');

  const repoUrl = 'https://github.com/vimlesh1975/htmlplayer.git';

  execSync('git init', { stdio: 'inherit' });

  try {
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
  } catch (e) {
    execSync(`git remote set-url origin ${repoUrl}`, { stdio: 'inherit' });
  }

  console.log('Adding files...');
  execSync('git add -A', { stdio: 'inherit' });

  console.log('Creating commit...');
  try {
    execSync('git commit -m "Integrate CeftoDecklink with 100% Pure HTML DOM playout and Hardware Key & Fill dual SDI output"', { stdio: 'inherit' });
  } catch (e) {
    console.log('Commit note:', e.message);
  }

  console.log('Setting branch main...');
  execSync('git branch -M main', { stdio: 'inherit' });

  console.log('Configuring Git HTTP buffer size...');
  execSync('git config http.postBuffer 1073741824', { stdio: 'inherit' });
  execSync('git config http.version HTTP/1.1', { stdio: 'inherit' });

  console.log('Pushing to remote origin main...');
  execSync('git push -u origin main', { stdio: 'inherit' });

  console.log('=======================================================');
  console.log(' Done! Successfully Pushed to GitHub!');
  console.log('=======================================================');
} catch (err) {
  console.error('Push script error:', err.message);
}
