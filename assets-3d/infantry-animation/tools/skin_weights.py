"""Local garment weight cleanup on animation copies; source meshes stay untouched."""
import math

def repair_garment(char):
 adjacent=[set()for v in char.data.vertices]
 for e in char.data.edges:
  a,b=e.vertices;adjacent[a].add(b);adjacent[b].add(a)
 seen=set();uniform=[]
 for i in range(len(adjacent)):
  if i in seen:continue
  todo=[i];seen.add(i);ids=[]
  while todo:
   k=todo.pop();ids.append(k)
   for j in adjacent[k]:
    if j not in seen:seen.add(j);todo.append(j)
  if len(ids)>2000 and min(char.data.vertices[k].co.z for k in ids)<.4 and max(char.data.vertices[k].co.z for k in ids)>1.5:uniform=ids;break
 assert uniform,'Uniform component not found'
 region={k for k in uniform if 1.24<char.data.vertices[k].co.z<1.57 and abs(char.data.vertices[k].co.x)<.32}
 values={k:{g.group:g.weight for g in char.data.vertices[k].groups}for k in uniform};initial={k:dict(values[k])for k in region}
 # The neck should not pull the shoulder cloth sideways during cheek weld.
 spine=char.vertex_groups['spine01'].index
 for k in region:
  p=char.data.vertices[k].co
  necks=[g for g in values[k]if char.vertex_groups[g].name.startswith('neck')]
  influence=max(0,min(1,(abs(p.x)-.06)/.04))
  for g in necks:
   amount=values[k][g]*influence;values[k][g]-=amount;values[k][spine]=values[k].get(spine,0)+amount
 # Smooth on real topology, retaining boundary weights outside the repair area.
 for _ in range(16):
  updated={}
  for k in region:
   ws=dict(values[k]);neighbors=adjacent[k];acc={}
   for j in neighbors:
    for g,w in values[j].items():acc[g]=acc.get(g,0)+w/len(neighbors)
   updated[k]={g:ws.get(g,0)*.45+acc.get(g,0)*.55 for g in set(ws)|set(acc)}
  values.update(updated)
 for k in region:
  ws=sorted(values[k].items(),key=lambda a:-a[1])[:4];total=sum(w for _,w in ws)
  for g in list(char.data.vertices[k].groups):char.vertex_groups[g.group].remove([k])
  for g,w in ws:char.vertex_groups[g].add([k],w/total,'REPLACE')
 boot_count=repair_boots(char)
 return {'boot_upper_vertices_reweighted':boot_count,'uniform_vertices':len(uniform),'shoulder_collar_vertices_reweighted':len(region),'smoothing_iterations':16,'scope':'clothing component shoulder/axilla/collar only; original sources untouched'}


def repair_boots(char):
 count=0
 for side in ['L','R']:
  foot=char.vertex_groups['foot.'+side];shin=char.vertex_groups['lowerleg01.'+side]
  ids=[v.index for v in char.data.vertices if v.co.z>.105 and any(g.group==foot.index and g.weight>.999 for g in v.groups)]
  for index in ids:
   z=char.data.vertices[index].co.z;u=max(0,min(1,(z-.105)/.10));blend=u*u*(3-2*u)
   for g in list(char.data.vertices[index].groups):char.vertex_groups[g.group].remove([index])
   if blend<.999999:foot.add([index],1-blend,'REPLACE')
   if blend>0:shin.add([index],blend,'REPLACE')
  count+=len(ids)
 return count
