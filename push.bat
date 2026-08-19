@echo off
echo =======================================================
echo  Committing and Pushing HTML Player to GitHub
echo  Repository: https://github.com/vimlesh1975/htmlplayer
echo =======================================================

git init
git remote add origin https://github.com/vimlesh1975/htmlplayer.git 2>nul
git remote set-url origin https://github.com/vimlesh1975/htmlplayer.git

echo Adding all files (including binaries and DLLs)...
git add -A

echo Creating commit...
git commit -m "Integrate CeftoDecklink with 100% Pure HTML DOM playout and Hardware Key & Fill dual SDI output"

echo Pushing to origin main...
git branch -M main
git push -u origin main

echo =======================================================
echo  Done! Successfully Pushed to GitHub!
echo =======================================================
pause
