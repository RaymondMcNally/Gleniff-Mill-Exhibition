import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon as MPoly, FancyArrow
import pickle
from shapely import affinity
plt.rcParams['font.family']='DejaVu Sans'; plt.rcParams['pdf.fonttype']=42

Z=np.load('dem.npy')[::5,::5]*0.2-103.86     # relative levels (0 = lowest ground of the survey), 1 m grid
Z=np.where(Z<-0.05,np.nan,Z)                  # drop edge spikes from the STL's base walls
from scipy.ndimage import binary_erosion
Z[~binary_erosion(~np.isnan(Z),iterations=3)]=np.nan
H,W=Z.shape; X,Y=np.meshgrid(np.arange(W)*1.0,np.arange(H)*1.0)   # real metres
d=pickle.load(open('state.pkl','rb'))
F=d['layers'][0]['geom']; F=max(F.geoms,key=lambda q:q.area) if hasattr(F,'geoms') else F
F=affinity.scale(F,0.2,0.2,origin=(0,0))      # real m
TH=21.8                                        # rotate CCW so long axis is horizontal
cx,cy=169,121
def rot(x,y):
    t=np.radians(TH); x0,y0=x-cx,y-cy
    return x0*np.cos(t)-y0*np.sin(t), x0*np.sin(t)+y0*np.cos(t)
RX,RY=rot(X,Y)
Fr=affinity.rotate(affinity.translate(F,-cx,-cy),TH,origin=(0,0))
fx0,fy0,fx1,fy1=Fr.bounds
RIVER=np.array([[319,300],[312,400],[275,500],[219,600],[166,700],[125,800],[128,900],[110,1000],[120,1100],[122,1180]])*0.2
TRIB=np.array([[1615,324],[1475,319],[1375,373],[1225,404],[1139,393],[1061,451],[985,555],[865,625],[806,690],[720,787],[643,817],[555,832],[475,851],[395,905]])*0.2
ROAD=np.array([[330,1207],[350,1100],[365,1000],[380,900],[395,800],[400,700],[405,620],[430,560],[520,505],[640,455],[1000,255],[1400,40],[1470,0]])*0.2
MILL=np.array([[412,590],[565,590],[565,765],[412,765]])*0.2
GREY='#8a8a8a'; DARK='#3a3a3a'

def mm(fig,x,y,w,h): # axes in mm from bottom-left
    Wf,Hf=fig.get_size_inches()*25.4; return fig.add_axes([x/Wf,y/Hf,w/Wf,h/Hf])

def plan(ax,xr,yr,scale,lab=True):
    ax.set_xlim(*xr); ax.set_ylim(*yr); ax.set_aspect('equal'); ax.axis('off')
    Zm=np.ma.masked_invalid(Z)
    ax.contour(RX,RY,Zm,levels=[l for l in range(1,39) if l%5],colors=GREY,linewidths=0.25)
    cs=ax.contour(RX,RY,Zm,levels=list(range(5,40,5)),colors=DARK,linewidths=0.55)
    if lab: ax.clabel(cs,fmt='%d',fontsize=6,inline_spacing=2)
    bx,by=Fr.exterior.xy; ax.plot(bx,by,color='k',lw=0.8)
    for P,ls in ((RIVER,(0,(4,2))),(TRIB,(0,(4,2)))):
        px,py=rot(P[:,0],P[:,1]); ax.plot(px,py,color='#5a7fa0',lw=0.6,ls=ls)
    qx,qy=rot(ROAD[:,0],ROAD[:,1]); ax.plot(qx,qy,color='#555',lw=1.6,solid_capstyle='round'); ax.plot(qx,qy,color='white',lw=0.9)
    k=len(qx)//2+2; ax.text(qx[k],qy[k]+3,'road',fontsize=5.5,color='#444',rotation=TH-28,ha='center')
    mx,my=rot(MILL[:,0],MILL[:,1]); ax.add_patch(MPoly(np.c_[mx,my],closed=True,fill=False,ec='k',lw=0.6,ls=(0,(2,1.5))))
    ax.text(mx.mean(),my.max()+4,'Mill foundations\n(approx.)',fontsize=5.5,ha='center',va='bottom')
    sx,sy=rot(np.array([95.0]),np.array([135.0])); ax.text(sx[0],sy[0],'+6.4',fontsize=5,ha='left'); ax.plot(sx,sy,'k+',ms=3,mew=0.4)
    rx,ry=rot(np.array([30.0]),np.array([200.0])); ax.text(rx[0],ry[0],'Ballintrillick River\n(approx.)',fontsize=5.5,color='#3f5f7f',rotation=TH+75,ha='center')
    tx,ty=rot(np.array([150.0]),np.array([158.0])); ax.text(tx[0],ty[0],'tributary (approx.)',fontsize=5.5,color='#3f5f7f',rotation=TH-28,ha='center')

def north(ax,x,y,size=12):
    t=np.radians(TH); dx,dy=-np.sin(t)*size,np.cos(t)*size
    ax.annotate('',xy=(x+dx,y+dy),xytext=(x-dx*0.3,y-dy*0.3),arrowprops=dict(arrowstyle='-|>',lw=0.8,color='k',mutation_scale=9))
    ax.text(x+dx*1.35,y+dy*1.35,'N',ha='center',va='center',fontsize=9,weight='bold')
    ax.add_patch(plt.Circle((x,y),size*0.55,fill=False,lw=0.5))

def scalebar(ax,x,y,metres,scale,step):
    L=metres*1000/scale
    for i,s in enumerate(range(0,metres,step)):
        w=step*1000/scale; ax.add_patch(Rectangle((x+s*1000/scale,y),w,2,fc='k' if i%2==0 else 'w',ec='k',lw=0.4))
    for s in range(0,metres+1,step): ax.text(x+s*1000/scale,y+3,f'{s}',fontsize=5.5,ha='center')
    ax.text(x+L+3,y+0.5,'m',fontsize=6)

def titleblock(ax,x,y,w,h,title,scale,paper,extra):
    ax.add_patch(Rectangle((x,y),w,h,fill=False,lw=0.6))
    rows=[('PROJECT','The Waters and the Wild · Project 1 Stage 1'),('SHEET',title),('SCALE',f'{scale} @ {paper}'),('DATE',''),('NAME',''),('MODULE','ARCT06004 Architecture Design Studio 1')]
    rh=9
    for i,(k,v) in enumerate(rows):
        yy=y+h-(i+1)*rh; ax.plot([x,x+w],[yy,yy],color='k',lw=0.3)
        ax.text(x+2,yy+rh-3,k,fontsize=4.8,color='#555',va='top'); ax.text(x+2,yy+2,v,fontsize=6.2,va='bottom')
    ax.text(x+2,y+h-len(rows)*rh-4,extra,fontsize=5.2,va='top',wrap=True,color='#333',linespacing=1.4)

NOTE=("UNDERLAY FOR TRACING. Not a finished drawing.\nTrace your base in freehand black ink.\n\n"
      "Contours at 1 m, index every 5 m (heavier, labelled).\nLevels in metres relative to the site datum:\n0 m is the lowest ground of the survey\n(ATU drone lidar, Oct 2025).\n"
      "Watercourses and mill foundations are\napproximate, read from the ground model.\nThe site selection boundary is in the brief, p.2.\n\nGleniff Barytes Mill · 54°23′56″N 8°24′02″W")

def sheet_A2(name,x0,x1,part):
    fig=plt.figure(figsize=(594/25.4,420/25.4)); bg=mm(fig,0,0,594,420); bg.set_xlim(0,594); bg.set_ylim(0,420); bg.axis('off')
    bg.add_patch(Rectangle((8,8),578,404,fill=False,lw=0.8))
    sc=500; yr=(fy0-6,fy1+6); dw=(x1-x0)*1000/sc; dh=(yr[1]-yr[0])*1000/sc
    ax=mm(fig,16,(420-dh)/2,dw,dh); plan(ax,(x0,x1),yr,sc)
    tx=594-8-112; titleblock(bg,tx,150,104,254,f'Site analysis base, 1:500 · {part}','1:500','A2',NOTE)
    north(bg,tx+30,110,13); scalebar(bg,tx+5,60,50,sc,10)
    # key plan
    k=mm(fig,tx+55,85,45,45*(fy1-fy0+12)/(fx1-fx0+12)); k.set_xlim(fx0-6,fx1+6); k.set_ylim(fy0-6,fy1+6); k.set_aspect('equal'); k.axis('off')
    bx,by=Fr.exterior.xy; k.plot(bx,by,'k',lw=0.4); k.add_patch(Rectangle((x0,yr[0]),x1-x0,yr[1]-yr[0],fc='#ddd',ec='k',lw=0.4)); k.plot(bx,by,'k',lw=0.4)
    bg.text(tx+55,80,'Key plan',fontsize=5.5)
    fig.savefig(f'site/downloads/base/{name}.pdf'); plt.close(fig)

span=fx1-fx0; win=(578-112-16)*500/1000-2   # metres visible per A2 sheet
sheet_A2('Gleniff_1-500_A2_sheet1_west',fx0-4,fx0-4+win,'sheet 1 of 2 (west, mill)')
sheet_A2('Gleniff_1-500_A2_sheet2_east',fx1+4-win,fx1+4,'sheet 2 of 2 (east, gorge)')

# A1 whole site
fig=plt.figure(figsize=(841/25.4,594/25.4)); bg=mm(fig,0,0,841,594); bg.set_xlim(0,841); bg.set_ylim(0,594); bg.axis('off')
bg.add_patch(Rectangle((8,8),825,578,fill=False,lw=0.8))
xr=(fx0-6,fx1+6); yr=(fy0-6,fy1+6); dw=(xr[1]-xr[0])*2; dh=(yr[1]-yr[0])*2
ax=mm(fig,(841-dw)/2,594-20-dh,dw,dh); plan(ax,xr,yr,500)
titleblock(bg,560,20,265,150,'Site analysis base, 1:500 · whole survey','1:500','A1',NOTE)
north(bg,470,110,16); scalebar(bg,330,40,100,500,10)
fig.savefig('site/downloads/base/Gleniff_1-500_A1_whole_survey.pdf'); plt.close(fig)

# A3 1:20,000 location template
fig=plt.figure(figsize=(420/25.4,297/25.4)); bg=mm(fig,0,0,420,297); bg.set_xlim(0,420); bg.set_ylim(0,297); bg.axis('off')
bg.add_patch(Rectangle((8,8),404,281,fill=False,lw=0.8))
fw,fh=290,265; fx,fy=16,16
bg.add_patch(Rectangle((fx,fy),fw,fh,fill=False,lw=0.5,ls=(0,(3,2))))
cxm,cym=fx+fw/2,fy+fh/2
# survey footprint at 1:20,000 (north up), centred on mill
Fn=affinity.scale(F,1000/20000,1000/20000,origin=(0,0)); mxr,myr=(MILL[:,0].mean(),MILL[:,1].mean())
Fn=affinity.translate(Fn,cxm-mxr/20,cym-myr/20)
bx,by=Fn.exterior.xy; bg.fill(bx,by,fc='none',ec='k',lw=0.7)
bg.plot([cxm-8,cxm+8],[cym,cym],'k',lw=0.4); bg.plot([cxm,cxm],[cym-8,cym+8],'k',lw=0.4)
bg.text(cxm+6,cym-12,'Gleniff Barytes Mill\nsurvey extent (to scale)',fontsize=6)
# 1 km check square
bg.add_patch(Rectangle((fx+8,fy+8),50,50,fill=False,lw=0.5)); bg.text(fx+33,fy+33,'1 km × 1 km\n= 50 × 50 mm\nat 1:20,000',fontsize=5.5,ha='center',va='center')
tx=320; titleblock(bg,tx,90,84,195,'Site location plan, 1:20,000','1:20,000','A3',
 "TEMPLATE. Draw or trace the\nsurrounding landscape at 1:20,000\ninside the frame: Benwiskin,\nTruskmore, Tievebaun, the\nGleniff Horseshoe road, rivers,\nBallintrillick, forestry.\n\nScale check: the frame is\n5.8 × 5.3 km. A 1 km grid\nsquare must measure 50 mm.\n\nMill: 54°23′56″N 8°24′02″W\n(Benwiskin Centre booklet).\nNorth is up on this sheet.")
TH0=TH; TH=0; north(bg,tx+20,60,10); TH=TH0
L=50; 
for i,s in enumerate(range(0,2000,500)): bg.add_patch(Rectangle((tx+4+s/20,30),25,2,fc='k' if i%2==0 else 'w',ec='k',lw=0.4))
for s in range(0,2001,500): bg.text(tx+4+s/20,34,f'{s}',fontsize=5,ha='center')
bg.text(tx+4+104,30.5,'m',fontsize=6)
fig.savefig('site/downloads/base/Gleniff_1-20000_A3_location_template.pdf'); plt.close(fig)
print('done', round(win), 'm per A2 sheet; survey span', round(span))
