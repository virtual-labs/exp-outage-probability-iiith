In experiment 1, we explored large scale fading models like pathloss and shadowing, which significantly influence wireless system design. In wireless communication, maintaining a minimum level of received power is crucial—for instance, the recieved power should be above a specific threshold to ensure cellular voice quality. However, pathloss and shadowing introduce attenuation effects that creates spatial variations in the received power, leading to situations not ensuring the minimum power requirement. To effectively characterize this fading phenomenon, a comprehensive understanding of outage and coverage becomes essential.

<p align="center">
<img src="./images/exp2.png" width="430">
</p>

## Outage Probability 
Outage probability $P_{out}$ is a critical metric in wireless communication systems, representing the probability that the received signal power at a certain distance falls below a specified threshold, making the communication link unreliable. In practical terms, it quantifies the probability that a user will experience poor connectivity or dropped calls. The outage probability at a distance $d$ can be written as 

$$
\begin{aligned}
    P_{out}\left(d,P_{min}\right) = P\left(P_r(d) < P_{min}\right)
\end{aligned}
$$
 
where $P_r(d)$ is the received power at a distance d and $P_{min}$ is target minimum received power.

Considering the log normal distance for shadowing, we have

$$
\begin{aligned}
    P_{out}\left(d,P_{min}\right) = 1 - Q\left(\frac{P_{min}-PL}{\sigma_{\psi_{dB}}}\right)
\end{aligned}
$$

where PL is the total pathloss that accounts for both linear pathloss and shadowing and $\sigma_{\psi_{dB}}$ is the standard deviation of the shadowing in dB. Q(.) is the Gaussian tail function, giving the probability that a normally distributed variable exceeds a certain value.

The above equation allows to predict how often users in different locations at same distance from the transmitter may experience poor connectivity. A high outage probability means that many users will experience dropped calls or low data rates.

## Cell Coverage Area
Closely related to outage probability is the concept of coverage area. Imagine a cellular base station emitting radio signals into the surrounding environment. The coverage area is the region within which the signal is strong enough to meet or exceed the required minimum power requirement $P_{min}$. Several factors including transmission power, antenna characteristics, environmental conditions, and the effects of pathloss and shadowing influence the extent of this coverage area. We can define it in the area $P_A$ in which the recieved power $P_r(d)$ is higher than $P_{min}$ and is given as 

$$
\begin{aligned}
    C = E\left[\frac{1}{\pi R^2} \int_{\text{cell area}} 1[P_r(d) > P_{min} \text{in dA}] dA\right]
\end{aligned}
$$

The knowledge of outage probability and cell coverage can aid to configure the system parameters to ensure certain level of quality of service for a given application like voice call.

In this experiment, we will investigate outage probability to understand its implications on wireless system design. By examining the conditions under which outage occurs, we can identify strategies to enhance coverage and reliability. This analysis will provide valuable insights into optimizing wireless networks to minimize outage probability and ensure consistent performance.
