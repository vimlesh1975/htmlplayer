@echo off
echo =======================================================
echo  Committing and Pushing HTML Player to GitHub
echo  Repository: https://github.com/vimlesh1975/htmlplayer
echo =======================================================

echo Initializing Git LFS...
git lfs install

git init
git remote add origin https://github.com/vimlesh1975/htmlplayer.git 2>nul
git remote set-url origin https://github.com/vimlesh1975/htmlplayer.git

echo Tracking large binary files with Git LFS...
git lfs track "*.dll"
git lfs track "*.exe"
git lfs track "*.pak"
git lfs track "*.dat"
git lfs track "*.lib"

echo Adding files (including build/Release)...
git add .gitattributes
git add -A

echo Creating commit...
git commit -m "Integrate CeftoDecklink with 100% Pure HTML DOM playout and Hardware Key & Fill dual SDI output (including build/Release binaries)"

echo Configuring Git HTTP buffer size for LFS/large files...
git config http.postBuffer 1073741824
git config http.version HTTP/1.1

echo Pushing to origin main...
git branch -M main
git push -u origin main

echo =======================================================
echo  Done! Successfully Pushed to GitHub!
echo =======================================================
pause

