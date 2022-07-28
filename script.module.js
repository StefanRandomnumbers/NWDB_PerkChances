import { html, render, useState, useEffect, useRef, useReducer } from '/standalone.js'
import { Component } from '/preact.module.js';


function App() {
  const [resultsReady, setResultsReady] = useState(false);
  const [url, setUrl] = useState('');
  const [perkInfos, setPerkInfos] = useState([]);
  const [removedLabels, setRemovedLabels] = useState([]);
  const [hideRemovedLabels, setHideRemovedLabels] = useState(false);
  const [selectedPerks, setSelectedPerks] = useState([]);
  const [rollChance, setRollChance] = useState(null);

  const dataReducer = (state, action) =>  {
    switch(action.type) {
      case 'renew':
        setRemovedLabels([]);
        return action.newState;
      case 'check':
        const { index } = action;
        const selected = selectedPerks.slice();
        // get a copy
        const newState = JSON.parse(JSON.stringify(state));
        const checkedItem = newState[index];
        let checked; // new item is checked or unchecked
        if (checkedItem.checked === false) {
          checked = true;
          if (selected.length === 3) {
            return state;
          }
          selected.push(checkedItem)
        } else {
          checked = false;
          selected.splice(selected.findIndex(e => e.perk.name === checkedItem.perk.name), 1);
        }

        checkedItem.checked = !checkedItem.checked;

        setSelectedPerks(selected);
        const newRemovedLabels = selected.reduce((r, c) => {
          r.push(...c.perk.labels);
          return r;
        }, []);

        setRemovedLabels(newRemovedLabels);

        function modifyChances (labels) {
          let totalChanceRemaining = 0;
          newState.forEach(item => {
            if (!compareLabels(item.labels, labels)) {
              item.chance = item.original.chance;
              totalChanceRemaining += item.original.chance;
            } 
          }); 

          let checksum = 0;
          newState.forEach(item => {
            if (!compareLabels(item.labels, labels)) {
              item.chanceAfter = item.chance / totalChanceRemaining ;
              checksum += item.chanceAfter;
            }
          });

          console.log('checksum is : ', checksum);
        }

        let rc = 1;

        if (!selected.length) {
          modifyChances([])
          setRollChance(null);
          return newState;
        }

        selected.forEach((selectedPerk, i) => {
          modifyChances(selectedPerk.perk.labels);

          if (i > 0) {
            rc =  rc * newState.find(e => e.perk.name === selectedPerk.perk.name).chanceAfter;
          }
        });

        setRollChance(rc);

        return newState;
    }
  }

  const [data, updateData] = useReducer(dataReducer, []);

  const getBuckets = async (url) => {
    let correctUrl = url;
    if (!url.includes('https://')) {
      correctUrl = 'https://' + correctUrl;
    }
    const r = await fetch('https://api.allorigins.win/raw?url=' + correctUrl + '.json');
    const json = await r.json();
    const bucket = json.data.perkBuckets.filter(e => e.type === 'Generated').pop();

    return bucket.perks;
  }

  const updateResults = async () => {
    // fill the tableData with only the relevant perk infos
    const r = await getBuckets(url);
  
    setPerkInfos(r);
  }

  useEffect(() => {
    if (perkInfos.length) {
      setResultsReady(true);
    }

    const d = perkInfos.map(item => {
      return {
        original: item,
        checked: false,
        perk: item.perk,
        labels: item.perk.labels,
        chance: item.chance,
        chanceAfter: item.chance
      }
    })
    
    updateData({
      type: 'renew',
      newState: d
    }) 
  }, [perkInfos])

  function compareLabels (labels, removedOverride) {
    let removedToCheck = removedOverride ? removedOverride : removedLabels;
    for (let label of labels) {
      if (removedToCheck.includes(label)) {
        return true;
      }
    }

    return false;
  }

  return html`
    <div>
      <form class="form" onSubmit=${(e) => {e.preventDefault(); updateResults()}}>
        <input id="url" placeholder="paste nwdb.info url..." type="text" value=${url} onChange=${(e) => setUrl(e.target.value)} />
        <button id="submit" type="submit">Go!</button>

        <div>
          <input id="hideremoved" type="checkbox" checked=${hideRemovedLabels} onChange=${() => setHideRemovedLabels(!hideRemovedLabels)}/>
          <label for="hideremoved">Select this if you want to hide eliminated perks from list</label>
        </div>
      </form>
      ${resultsReady ?
        html`
          <p>
            Select a perk to craft with, this will in turn increase the chances of every other perk that does not share labels with selected one.
          </p>
        ` : null
      }

      ${selectedPerks.length ? 
      html`<p class="selected-perks">
        <span class="header">Selected perks :</span>
        ${
          selectedPerks.map(p => html`<span class="perk">${p.perk.name}</span>`)
        }
        ${ rollChance !== null ? html`<span class="roll-chance">Roll chance ${selectedPerks.length === 3 ? '(assuming legendary)' : ''}: ${(rollChance * 100).toFixed(6)} %</span>` : null }
      </p>` : html`<p class="selected-perks"></p>`}

      ${ resultsReady ? 
          html`
            <table class="tb">
              <thead>
                <th></th>
                <th>Perk</th>
                <th>Label</th>
                <th>Chance</th>
                <th>New Chance</th>
              </thead>
              <tbody>
                ${
                  data.map((item, index) => {
                    const perkIsRemoved = compareLabels(item.perk.labels) && !item.checked;
                    if (perkIsRemoved && hideRemovedLabels) {
                      return null;
                    }

                    return html`
                      <tr style=${{ 'background-color': compareLabels(item.perk.labels) ? 'lightgray' : 'white' }}>
                        <td>
                          <input disabled=${!item.checked  && (compareLabels(item.perk.labels) || selectedPerks.length === 3 )} type="checkbox" checked=${item.checked}
                            onChange=${() => updateData({ type: 'check', index })}/>
                        </td>
                        <td>
                          <a href="${'https://nwdb.info/db/perk/' + item.perk.id}">${item.perk.name}</a>
                        </td>
                        <td>
                          ${item.perk.labels.join(', ')}
                        </td>
                        <td>${item.checked || compareLabels(item.perk.labels) ? '-' : (item.chance * 100).toFixed(2)}</td>
                        <td>${item.checked || compareLabels(item.perk.labels) ? '-' : (item.chanceAfter * 100).toFixed(2)}</td>
                      </tr> `;
                })
                }
              </tbody>
            </table>
          ` : 
          null

      }
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
