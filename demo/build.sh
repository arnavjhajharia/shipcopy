#!/bin/bash
# Assemble the captioned ShipCopy demo from frames/f1..f5.jpg (real Chrome screenshots of the live app, strategist s34).
set -e; cd "$(dirname "$0")"
durs=(8 9 9 9 10); args=(); filt=""
for j in 0 1 2 3 4; do d=${durs[$j]}; args+=(-loop 1 -t $d -i frames/f$((j+1)).jpg)
  filt+="[$j:v]scale=1920:-2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0d14,setsar=1,fps=30,fade=t=in:st=0:d=0.4,fade=t=out:st=$(echo "$d-0.4"|bc):d=0.4[v$j];"; done
ffmpeg -y -loglevel error "${args[@]}" -f lavfi -t 45 -i anullsrc=r=44100:cl=stereo -filter_complex "${filt}[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[v]" -map "[v]" -map 5:a -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -shortest shipcopy-demo.mp4
ffprobe -v error -show_entries format=duration,size -of csv=p=0 shipcopy-demo.mp4
